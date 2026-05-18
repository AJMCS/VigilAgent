"""FastAPI backend for VigilAgent."""
import asyncio
import json
import re
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import DefaultDict
from collections import defaultdict

import httpx
import structlog
from fastapi import BackgroundTasks, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl, field_validator

from agent.config import settings
from agent.tools.clone import clone_repo
from agent.tools.scan_static import scan_static
from agent.tools.scan_deps import scan_deps
from agent.tools.scan_secrets import scan_secrets
from agent.tools.report import synthesize_report

log = structlog.get_logger()

WATCHLIST_PATH = Path(__file__).parent.parent / "watchlist.json"
PIPELINE_STEPS = ["clone", "static_analysis", "dependency_audit", "secret_scan", "report"]

# ── In-memory stores ───────────────────────────────────────────────────────────

_jobs: dict[str, dict] = {}
_tasks: dict[str, asyncio.Task] = {}           # job_id → cancellable asyncio task
_seen_prs: DefaultDict[str, set] = defaultdict(set)  # repo_url → set of PR numbers


# ── Watchlist helpers ──────────────────────────────────────────────────────────

def _load_watchlist() -> list[dict]:
    if WATCHLIST_PATH.exists():
        try:
            return json.loads(WATCHLIST_PATH.read_text())
        except Exception:
            return []
    return []


def _save_watchlist(entries: list[dict]) -> None:
    WATCHLIST_PATH.write_text(json.dumps(entries, indent=2))


# ── PR comment ────────────────────────────────────────────────────────────────

def _extract_executive_summary(report_text: str) -> str:
    m = re.search(r"##\s*Executive Summary\s*\n(.*?)(?=\n##|\Z)", report_text, re.DOTALL)
    if m:
        return m.group(1).strip()[:600]
    return report_text[:300].strip()


def _extract_risk_score(report_text: str) -> int | None:
    m = re.search(r"risk score[^0-9]*(\d{1,3})", report_text, re.IGNORECASE)
    return int(m.group(1)) if m else None


def _risk_label(score: int) -> str:
    if score >= 75: return "🔴 Critical"
    if score >= 50: return "🟠 High"
    if score >= 25: return "🟡 Medium"
    return "🟢 Low"


async def _is_repo_contributor(token: str, owner: str, repo: str) -> bool:
    """Return True only if the token's GitHub user is a collaborator on owner/repo.

    Uses the GitHub collaborators endpoint — 204 means confirmed collaborator,
    anything else (404 not a collaborator, 403 insufficient scope, network error)
    is treated as denied. No exceptions.
    """
    gh_headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            user_resp = await client.get("https://api.github.com/user", headers=gh_headers)
            if user_resp.status_code != 200:
                log.warning("contributor check: could not resolve user", status=user_resp.status_code)
                return False
            username = user_resp.json().get("login", "")
            if not username:
                return False

            collab_resp = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/collaborators/{username}",
                headers=gh_headers,
            )
            allowed = collab_resp.status_code == 204
            if not allowed:
                log.warning(
                    "contributor check: blocked",
                    username=username, owner=owner, repo=repo,
                    status=collab_resp.status_code,
                )
            return allowed
    except Exception as exc:
        log.error("contributor check: exception", error=str(exc))
        return False


async def _post_pr_comment(
    token: str,
    owner: str,
    repo: str,
    pr_number: int,
    job_id: str,
    report: dict,
) -> None:
    if not await _is_repo_contributor(token, owner, repo):
        log.warning(
            "pr comment suppressed — token user is not a contributor",
            owner=owner, repo=repo, pr=pr_number,
        )
        return

    report_text = report.get("report", "")
    risk_score = _extract_risk_score(report_text)
    summary = _extract_executive_summary(report_text)
    generated_at = report.get("generated_at", "")[:19].replace("T", " ") + " UTC"

    score_line = (
        f"**Risk Score: {risk_score} / 100 — {_risk_label(risk_score)}**"
        if risk_score is not None
        else ""
    )

    body = f"""## 🛡️ VigilAgent Security Scan

**PR:** #{pr_number} · `{repo}`
{score_line}
**Scanned at:** {generated_at}

### Executive Summary
> {summary}

---
*Powered by VigilAgent + Nemotron (local) · [Full report in dashboard](http://localhost:5173/report/{report.get("generated_at","")[:10].replace("-","_")})*
"""

    url = f"https://api.github.com/repos/{owner}/{repo}/issues/{pr_number}/comments"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(url, headers=headers, json={"body": body})
        if resp.status_code not in (200, 201):
            log.warning("pr comment failed", status=resp.status_code, body=resp.text[:200])
        else:
            log.info("pr comment posted", owner=owner, repo=repo, pr=pr_number)


# ── Pipeline ──────────────────────────────────────────────────────────────────

def _set_agent(job: dict, agent: str) -> None:
    job["current_agent"] = agent
    idx = PIPELINE_STEPS.index(agent)
    job["agents_done"] = PIPELINE_STEPS[:idx]


async def _run_pipeline(
    job_id: str,
    github_token: str,
    repos: list[str],
    branch: str | None = None,
    pr_meta: dict | None = None,
) -> None:
    job = _jobs[job_id]
    job["status"] = "running"
    results = []

    for repo_url in repos:
        job["current_repo"] = repo_url
        job["agents_done"] = []
        repo_result = {"repo_url": repo_url, "success": True, "error": None, "report": {}}

        try:
            _set_agent(job, "clone")
            log.info("cloning", job_id=job_id, repo=repo_url, branch=branch)
            clone_result = await asyncio.to_thread(clone_repo, github_token, repo_url, branch)
            if not clone_result["success"]:
                repo_result.update(success=False, error=f"Clone failed: {clone_result['error']}")
                results.append(repo_result)
                continue

            repo_path = clone_result["path"]

            _set_agent(job, "static_analysis")
            static_result = await asyncio.to_thread(scan_static, repo_path)

            _set_agent(job, "dependency_audit")
            deps_result = await asyncio.to_thread(scan_deps, repo_path)

            _set_agent(job, "secret_scan")
            secrets_result = await asyncio.to_thread(scan_secrets, repo_path)

            _set_agent(job, "report")
            scan_results = {
                "static_analysis": static_result,
                "dependency_audit": deps_result,
                "secret_scan": secrets_result,
            }
            report = await asyncio.to_thread(synthesize_report, repo_url, scan_results, repo_path)
            repo_result["report"] = report

            # Post PR comment if this was auto-triggered
            if pr_meta and report:
                await _post_pr_comment(
                    token=github_token,
                    owner=pr_meta["owner"],
                    repo=pr_meta["repo"],
                    pr_number=pr_meta["number"],
                    job_id=job_id,
                    report=report,
                )

        except asyncio.CancelledError:
            # Bubble up — outer handler marks the job cancelled
            raise
        except Exception as exc:
            log.error("scan error", job_id=job_id, repo=repo_url, error=str(exc))
            repo_result.update(success=False, error=str(exc))

        results.append(repo_result)

    job.update(
        status="completed",
        current_agent=None,
        current_repo=None,
        agents_done=PIPELINE_STEPS,
        results=results,
    )
    log.info("job complete", job_id=job_id)


# Wrap the pipeline so CancelledError is caught cleanly without crashing the task
async def _run_pipeline_safe(
    job_id: str,
    github_token: str,
    repos: list[str],
    branch: str | None = None,
    pr_meta: dict | None = None,
) -> None:
    try:
        await _run_pipeline(job_id, github_token, repos, branch, pr_meta)
    except asyncio.CancelledError:
        _jobs[job_id].update(
            status="cancelled",
            current_agent=None,
            current_repo=None,
        )
        log.info("pipeline cancelled", job_id=job_id)
    finally:
        _tasks.pop(job_id, None)


# ── PR polling ────────────────────────────────────────────────────────────────

async def _fetch_open_prs(entry: dict) -> list[dict]:
    owner, repo = entry["owner"], entry["repo"]
    url = f"https://api.github.com/repos/{owner}/{repo}/pulls?state=open&sort=created&direction=desc&per_page=20"
    headers = {
        "Authorization": f"Bearer {entry['github_token']}",
        "Accept": "application/vnd.github+json",
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                return resp.json()
    except Exception as exc:
        log.warning("pr fetch failed", repo=f"{owner}/{repo}", error=str(exc))
    return []


async def _run_pr_scan(entry: dict, pr: dict) -> None:
    repo_url = entry["repo_url"]
    branch = pr["head"]["ref"]
    pr_meta = {
        "owner": entry["owner"],
        "repo": entry["repo"],
        "number": pr["number"],
        "title": pr["title"],
        "author": pr["user"]["login"],
        "branch": branch,
    }

    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "job_id": job_id,
        "status": "queued",
        "trigger": "auto_pr",
        "pr_number": pr["number"],
        "pr_title": pr["title"],
        "pr_author": pr["user"]["login"],
        "pr_branch": branch,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "repos": [repo_url],
        "current_repo": None,
        "current_agent": None,
        "agents_done": [],
        "results": None,
        "error": None,
    }

    log.info("auto pr scan queued", job_id=job_id, repo=repo_url, pr=pr["number"])
    await _run_pipeline(
        job_id=job_id,
        github_token=entry["github_token"],
        repos=[repo_url],
        branch=branch,
        pr_meta=pr_meta,
    )


async def _poll_loop() -> None:
    log.info("pr poll loop started", interval_seconds=settings.poll_interval_seconds)
    while True:
        await asyncio.sleep(settings.poll_interval_seconds)
        watchlist = _load_watchlist()
        if not watchlist:
            continue
        log.info("polling watched repos", count=len(watchlist))
        for entry in watchlist:
            prs = await _fetch_open_prs(entry)
            repo_url = entry["repo_url"]
            for pr in prs:
                if pr["number"] not in _seen_prs[repo_url]:
                    _seen_prs[repo_url].add(pr["number"])
                    asyncio.create_task(_run_pr_scan(entry, pr))


# ── App lifespan ──────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_poll_loop())
    yield
    task.cancel()


app = FastAPI(
    title="VigilAgent",
    description="Autonomous GitHub security auditing agent powered by Nemotron.",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / response models ─────────────────────────────────────────────────

class ScanRequest(BaseModel):
    github_token: str
    repos: list[HttpUrl]

    @field_validator("repos")
    @classmethod
    def repos_not_empty(cls, v):
        if not v:
            raise ValueError("repos list must not be empty")
        return v


# ── Security report schema ────────────────────────────────────────────────────

class ReportMeta(BaseModel):
    repo: str = ""
    branch: str = "unknown"
    commit: str = "unknown"
    scanned_at: str = ""
    scan_duration_seconds: float = 0
    model: str = ""
    vigilagent_version: str = "1.0.0"

class BySeverity(BaseModel):
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0

class ByCategory(BaseModel):
    static_analysis: int = 0
    dependency_audit: int = 0
    secret_detection: int = 0

class ReportSummary(BaseModel):
    overall_severity: str = "UNKNOWN"
    total_findings: int = 0
    by_severity: BySeverity = BySeverity()
    by_category: ByCategory = ByCategory()
    top_priority_finding: str = ""

class StaticFinding(BaseModel):
    model_config = {"extra": "allow"}
    id: str = ""
    severity: str
    rule: str = ""
    tool: str = ""
    file: str = ""
    line: int | None = None
    description: str = ""
    recommendation: str = ""
    raw_output: str = ""

class DependencyFinding(BaseModel):
    model_config = {"extra": "allow"}
    id: str = ""
    severity: str
    tool: str = ""
    package: str = ""
    version: str = ""
    cve: str = ""
    description: str = ""
    recommendation: str = ""
    raw_output: str = ""

class SecretFinding(BaseModel):
    model_config = {"extra": "allow"}
    id: str = ""
    severity: str
    tool: str = ""
    secret_type: str = ""
    file: str = ""
    line: int | None = None
    commit: str = ""
    description: str = ""
    recommendation: str = ""
    raw_output: str = ""

class ReportFindings(BaseModel):
    static_analysis: list[StaticFinding] = []
    dependency_audit: list[DependencyFinding] = []
    secret_detection: list[SecretFinding] = []

class AiSynthesis(BaseModel):
    executive_summary: str = ""
    critical_actions: list[str] = []
    risk_assessment: str = ""
    recommended_priority_order: list[str] = []

class SecurityReport(BaseModel):
    model_config = {"extra": "allow"}
    meta: ReportMeta = ReportMeta()
    summary: ReportSummary = ReportSummary()
    findings: ReportFindings = ReportFindings()
    ai_synthesis: AiSynthesis = AiSynthesis()
    parse_error: str | None = None
    raw_model_output: str | None = None


class WatchRequest(BaseModel):
    repo_url: str
    github_token: str


class ChatRequest(BaseModel):
    question: str
    history: list[dict] = []   # [{role: "user"|"assistant", content: str}]


class JobStatus(BaseModel):
    job_id: str
    status: str
    trigger: str = "manual"
    pr_number: int | None = None
    pr_title: str | None = None
    pr_author: str | None = None
    pr_branch: str | None = None
    created_at: str
    repos: list[str]
    current_repo: str | None = None
    current_agent: str | None = None
    agents_done: list[str] = []
    results: list[dict] | None = None
    error: str | None = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "model": settings.primary_model,
        "watching": len(_load_watchlist()),
        "poll_interval_seconds": settings.poll_interval_seconds,
    }


@app.post("/scan", response_model=JobStatus, status_code=status.HTTP_202_ACCEPTED)
async def start_scan(body: ScanRequest) -> JobStatus:
    job_id = str(uuid.uuid4())
    repos = [str(r) for r in body.repos]
    _jobs[job_id] = {
        "job_id": job_id,
        "status": "queued",
        "trigger": "manual",
        "pr_number": None,
        "pr_title": None,
        "pr_author": None,
        "pr_branch": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "repos": repos,
        "current_repo": None,
        "current_agent": None,
        "agents_done": [],
        "results": None,
        "error": None,
    }
    task = asyncio.create_task(_run_pipeline_safe(job_id, body.github_token, repos))
    _tasks[job_id] = task
    log.info("manual scan queued", job_id=job_id, repo_count=len(repos))
    return JobStatus(**_jobs[job_id])


@app.get("/scan/{job_id}", response_model=JobStatus)
def get_scan(job_id: str) -> JobStatus:
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return JobStatus(**job)


@app.get("/scans", response_model=list[JobStatus])
def list_scans() -> list[JobStatus]:
    return [JobStatus(**j) for j in _jobs.values()]


@app.post("/scan/{job_id}/cancel")
async def cancel_scan(job_id: str) -> dict:
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    if job["status"] not in ("queued", "running"):
        raise HTTPException(status_code=400, detail="Job is not active")

    task = _tasks.get(job_id)
    if task and not task.done():
        task.cancel()
    else:
        # Auto-PR jobs aren't tracked in _tasks — mark directly
        job.update(status="cancelled", current_agent=None, current_repo=None)
        _tasks.pop(job_id, None)

    log.info("scan cancel requested", job_id=job_id)
    return {"job_id": job_id, "status": "cancelled"}


# ── Watchlist endpoints ───────────────────────────────────────────────────────

@app.get("/watch")
def get_watchlist() -> list[dict]:
    return [
        {"repo_url": e["repo_url"], "owner": e["owner"], "repo": e["repo"]}
        for e in _load_watchlist()
    ]


@app.post("/watch", status_code=status.HTTP_201_CREATED)
def add_watch(body: WatchRequest) -> dict:
    url = body.repo_url.rstrip("/")
    parts = url.split("github.com/")
    if len(parts) < 2 or "/" not in parts[1]:
        raise HTTPException(status_code=400, detail="Must be a valid GitHub repo URL")
    owner, repo = parts[1].split("/", 1)
    repo = repo.rstrip(".git")

    watchlist = _load_watchlist()
    if any(e["repo_url"] == url for e in watchlist):
        raise HTTPException(status_code=409, detail="Repo already in watchlist")

    entry = {"repo_url": url, "github_token": body.github_token, "owner": owner, "repo": repo}
    watchlist.append(entry)
    _save_watchlist(watchlist)
    log.info("repo added to watchlist", owner=owner, repo=repo)
    return {"owner": owner, "repo": repo, "repo_url": url}


@app.delete("/watch/{owner}/{repo}", status_code=status.HTTP_204_NO_CONTENT)
def remove_watch(owner: str, repo: str) -> None:
    watchlist = _load_watchlist()
    updated = [e for e in watchlist if not (e["owner"] == owner and e["repo"] == repo)]
    if len(updated) == len(watchlist):
        raise HTTPException(status_code=404, detail="Repo not in watchlist")
    _save_watchlist(updated)
    _seen_prs.pop(f"https://github.com/{owner}/{repo}", None)
    log.info("repo removed from watchlist", owner=owner, repo=repo)


# ── Reports endpoints ─────────────────────────────────────────────────────────

@app.get("/reports")
def list_reports() -> list[dict]:
    try:
        settings.reports_dir.mkdir(parents=True, exist_ok=True)
        files = sorted(settings.reports_dir.glob("*.json"), reverse=True)
        return [{"filename": f.name, "size_bytes": f.stat().st_size} for f in files]
    except Exception as exc:
        log.error("list_reports failed", error=str(exc))
        return []


@app.get("/reports/{filename}", response_model=SecurityReport)
def get_report(filename: str) -> SecurityReport:
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = settings.reports_dir / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Report not found")
    data = json.loads(path.read_text(encoding="utf-8"))
    try:
        return SecurityReport.model_validate(data)
    except Exception as exc:
        log.warning("report validation failed, returning raw", filename=filename, error=str(exc))
        return data


@app.post("/reports/{filename}/chat")
async def chat_with_report(filename: str, body: ChatRequest) -> dict:
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = settings.reports_dir / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Report not found")

    report = json.loads(path.read_text(encoding="utf-8"))

    # Support both new structured schema and legacy markdown schema
    is_new = "meta" in report and "findings" in report and "ai_synthesis" in report

    if is_new:
        meta      = report.get("meta", {})
        summary   = report.get("summary", {})
        findings  = report.get("findings", {})
        synthesis = report.get("ai_synthesis", {})
        repo_url  = meta.get("repo", "unknown")
        scanned   = meta.get("scanned_at", "unknown")
        findings_json = json.dumps(findings, indent=2)
        if len(findings_json) > 6000:
            findings_json = findings_json[:6000] + "\n... [truncated]"
        system = (
            f"You are VigilAgent, a security expert assistant helping a developer understand "
            f"a security audit report.\n\n"
            f"Repository: {repo_url}\n"
            f"Scanned at: {scanned}\n"
            f"Overall severity: {summary.get('overall_severity', 'UNKNOWN')}\n"
            f"Total findings: {summary.get('total_findings', 0)}\n\n"
            f"AI SYNTHESIS:\n"
            f"Executive summary: {synthesis.get('executive_summary', '')}\n"
            f"Risk assessment: {synthesis.get('risk_assessment', '')}\n\n"
            f"STRUCTURED FINDINGS (JSON — cite id, file, line, description when answering):\n"
            f"{findings_json}\n\n"
            f"Answer questions based only on the findings above. "
            f"Cite specific finding IDs, files, line numbers, or CVEs. Be concise and actionable."
        )
    else:
        # Legacy markdown report
        system = (
            f"You are VigilAgent, a security expert assistant helping a developer understand "
            f"a security audit report.\n\n"
            f"Repository: {report.get('repo_url', 'unknown')}\n"
            f"Scanned at: {report.get('generated_at', 'unknown')}\n\n"
            f"SECURITY REPORT:\n{report.get('report', '')}\n\n"
            f"RAW TOOL FINDINGS (JSON):\n"
            f"{json.dumps(report.get('raw_scan_results', {}))[:4000]}\n\n"
            f"Answer questions based only on the findings above. "
            f"Cite specific files, line numbers, or CVEs when relevant. Be concise and actionable."
        )

    messages = [{"role": "system", "content": system}]
    messages.extend(body.history)
    messages.append({"role": "user", "content": body.question})

    from openai import OpenAI as _OpenAI
    client = _OpenAI(api_key=settings.llm_api_key, base_url=settings.llm_base_url)

    response = await asyncio.to_thread(
        lambda: client.chat.completions.create(
            model=settings.primary_model,
            messages=messages,
            temperature=0.3,
            max_tokens=1024,
        )
    )
    return {"answer": response.choices[0].message.content}
