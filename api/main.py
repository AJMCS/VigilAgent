"""FastAPI backend for VigilAgent."""
import asyncio
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

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

app = FastAPI(
    title="VigilAgent",
    description="Autonomous GitHub security auditing agent powered by Nemotron.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory job store ────────────────────────────────────────────────────────

_jobs: dict[str, dict] = {}

PIPELINE_STEPS = ["clone", "static_analysis", "dependency_audit", "secret_scan", "report"]

# ── Models ────────────────────────────────────────────────────────────────────

class ScanRequest(BaseModel):
    github_token: str
    repos: list[HttpUrl]

    @field_validator("repos")
    @classmethod
    def repos_not_empty(cls, v: list) -> list:
        if not v:
            raise ValueError("repos list must not be empty")
        return v


class JobStatus(BaseModel):
    job_id: str
    status: str          # queued | running | completed | failed
    created_at: str
    repos: list[str]
    current_repo: str | None = None
    current_agent: str | None = None
    agents_done: list[str] = []
    results: list[dict] | None = None
    error: str | None = None


# ── Pipeline ──────────────────────────────────────────────────────────────────

def _set_agent(job: dict, agent: str) -> None:
    job["current_agent"] = agent
    if agent not in job["agents_done"]:
        # mark the previous agent done
        idx = PIPELINE_STEPS.index(agent)
        job["agents_done"] = PIPELINE_STEPS[:idx]


async def _run_pipeline(job_id: str, github_token: str, repos: list[str]) -> None:
    job = _jobs[job_id]
    job["status"] = "running"
    results = []

    for repo_url in repos:
        job["current_repo"] = repo_url
        job["agents_done"] = []
        repo_result = {"repo_url": repo_url, "success": True, "error": None, "report": {}}

        try:
            # Agent 1: Clone
            _set_agent(job, "clone")
            log.info("cloning", job_id=job_id, repo=repo_url)
            clone_result = await asyncio.to_thread(clone_repo, github_token, repo_url)
            if not clone_result["success"]:
                repo_result["success"] = False
                repo_result["error"] = f"Clone failed: {clone_result['error']}"
                results.append(repo_result)
                continue

            repo_path = clone_result["path"]

            # Agent 2: Static analysis
            _set_agent(job, "static_analysis")
            log.info("static analysis", job_id=job_id, repo=repo_url)
            static_result = await asyncio.to_thread(scan_static, repo_path)

            # Agent 3: Dependency audit
            _set_agent(job, "dependency_audit")
            log.info("dependency audit", job_id=job_id, repo=repo_url)
            deps_result = await asyncio.to_thread(scan_deps, repo_path)

            # Agent 4: Secret scan
            _set_agent(job, "secret_scan")
            log.info("secret scan", job_id=job_id, repo=repo_url)
            secrets_result = await asyncio.to_thread(scan_secrets, repo_path)

            # Agent 5: Report synthesis
            _set_agent(job, "report")
            log.info("synthesizing report", job_id=job_id, repo=repo_url)
            scan_results = {
                "static_analysis": static_result,
                "dependency_audit": deps_result,
                "secret_scan": secrets_result,
            }
            report = await asyncio.to_thread(synthesize_report, repo_url, scan_results)
            repo_result["report"] = report

        except Exception as exc:
            log.error("scan error", job_id=job_id, repo=repo_url, error=str(exc))
            repo_result["success"] = False
            repo_result["error"] = str(exc)

        results.append(repo_result)

    job["status"] = "completed"
    job["current_agent"] = None
    job["current_repo"] = None
    job["agents_done"] = PIPELINE_STEPS
    job["results"] = results
    log.info("job complete", job_id=job_id, repos_scanned=len(results))


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model": settings.primary_model}


@app.post("/scan", response_model=JobStatus, status_code=status.HTTP_202_ACCEPTED)
async def start_scan(body: ScanRequest, background_tasks: BackgroundTasks) -> JobStatus:
    job_id = str(uuid.uuid4())
    repos = [str(r) for r in body.repos]

    _jobs[job_id] = {
        "job_id": job_id,
        "status": "queued",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "repos": repos,
        "current_repo": None,
        "current_agent": None,
        "agents_done": [],
        "results": None,
        "error": None,
    }

    background_tasks.add_task(_run_pipeline, job_id, body.github_token, repos)
    log.info("scan job queued", job_id=job_id, repo_count=len(repos))
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


@app.get("/reports")
def list_reports() -> list[dict]:
    files = sorted(settings.reports_dir.glob("*.json"), reverse=True)
    return [{"filename": f.name, "size_bytes": f.stat().st_size} for f in files]


@app.get("/reports/{filename}")
def get_report(filename: str) -> dict:
    # Prevent path traversal
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = settings.reports_dir / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Report not found")
    return json.loads(path.read_text())
