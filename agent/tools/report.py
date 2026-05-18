"""Synthesize scan results into a structured JSON report using Nemotron."""
import json
import re
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

from openai import OpenAI

from agent.config import settings

# ── Constants ──────────────────────────────────────────────────────────────────

VIGILAGENT_VERSION = "1.0.0"
REQUIRED_KEYS = {"meta", "summary", "findings", "ai_synthesis"}

SYSTEM_PROMPT = (
    "You are a security report generator. "
    "You must respond with ONLY a valid JSON object matching the provided schema. "
    "No markdown, no backticks, no explanation. Just the raw JSON."
)

SCHEMA = """{
  "meta": {},
  "summary": {
    "overall_severity": "CRITICAL | HIGH | MEDIUM | LOW | CLEAN",
    "total_findings": 0,
    "by_severity": { "critical": 0, "high": 0, "medium": 0, "low": 0 },
    "by_category": { "static_analysis": 0, "dependency_audit": 0, "secret_detection": 0 },
    "top_priority_finding": "one sentence description of the most critical issue, or CLEAN if none"
  },
  "findings": {
    "static_analysis": [
      {
        "severity": "CRITICAL | HIGH | MEDIUM | LOW",
        "rule": "rule or check name",
        "tool": "semgrep | bandit",
        "file": "relative/path/to/file.py",
        "line": 42,
        "description": "what the issue is",
        "recommendation": "how to fix it",
        "attack_scenario": "1-2 sentence story of how an attacker would actually exploit this specific finding",
        "blast_radius": "what data, systems, or access is compromised if this is exploited",
        "false_positive_likelihood": "LOW | MEDIUM | HIGH",
        "false_positive_reasoning": "brief explanation of why this is or isn't likely a false positive",
        "verification_steps": ["step to confirm the fix worked", "another verification step"],
        "raw_output": "relevant raw tool output snippet"
      }
    ],
    "dependency_audit": [
      {
        "severity": "CRITICAL | HIGH | MEDIUM | LOW",
        "tool": "pip-audit | npm-audit",
        "package": "package-name",
        "version": "1.2.3",
        "cve": "CVE-YYYY-NNNNN or empty string",
        "description": "what the vulnerability is",
        "recommendation": "upgrade to version X or workaround",
        "attack_scenario": "1-2 sentence story of how an attacker would exploit this CVE or vulnerable package",
        "blast_radius": "what data, systems, or access is compromised if this is exploited",
        "false_positive_likelihood": "LOW | MEDIUM | HIGH",
        "false_positive_reasoning": "brief explanation — e.g. known CVE with PoC = LOW, version range mismatch = MEDIUM",
        "verification_steps": ["run pip-audit or npm audit again after upgrading", "another verification step"],
        "raw_output": "relevant raw tool output snippet"
      }
    ],
    "secret_detection": [
      {
        "severity": "CRITICAL | HIGH | MEDIUM | LOW",
        "tool": "gitleaks | trufflehog",
        "secret_type": "type of secret e.g. AWS Access Key",
        "file": "relative/path/to/file",
        "line": 10,
        "commit": "commit hash or empty string",
        "description": "what was found",
        "recommendation": "revoke immediately, rotate credentials, add to .gitignore",
        "attack_scenario": "1-2 sentence story of what an attacker could do with this specific secret",
        "blast_radius": "what systems, data, or accounts this secret controls",
        "false_positive_likelihood": "LOW | MEDIUM | HIGH",
        "false_positive_reasoning": "e.g. test/example value = HIGH, real-looking key pattern = LOW",
        "verification_steps": ["revoke and rotate the credential", "run secret scan again to confirm removal", "audit access logs for unauthorized use"],
        "raw_output": "relevant raw tool output snippet"
      }
    ]
  },
  "ai_synthesis": {
    "executive_summary": "2-3 sentence plain English overview of overall security posture",
    "critical_actions": ["immediate action items only, one per element"],
    "risk_assessment": "one paragraph plain English risk explanation",
    "recommended_priority_order": ["finding description ordered most to least urgent, one per element"],
    "single_most_important_action": "one decisive sentence — if the developer can only do one thing right now, this is it",
    "finding_relationships": [
      {
        "group_name": "short label for this cluster of related findings",
        "finding_ids": ["SA-001", "DA-002"],
        "explanation": "how these findings relate, compound each other, or form an attack chain"
      }
    ],
    "scan_coverage_gaps": ["a thing this scan did NOT check that the developer should still consider"],
    "clean_repo_context": "if total_findings is 0: explain what clean means given the tools used and what to still watch for; if findings exist set to empty string"
  }
}"""


# ── Helpers ────────────────────────────────────────────────────────────────────

def _strip_fences(text: str) -> str:
    text = text.strip()
    m = re.match(r'^```(?:json)?\s*\n?(.*?)\n?```\s*$', text, re.DOTALL)
    return m.group(1).strip() if m else text


def _parse_and_validate(raw: str) -> dict:
    cleaned = _strip_fences(raw)
    data = json.loads(cleaned)
    missing = REQUIRED_KEYS - set(data.keys())
    if missing:
        raise ValueError(f"Missing top-level keys: {missing}")
    return data


def _get_git_info(clone_path: str | None) -> tuple[str, str]:
    branch, commit = "unknown", "unknown"
    if not clone_path:
        return branch, commit
    try:
        b = subprocess.run(
            ["git", "-C", clone_path, "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True, text=True, timeout=5,
        )
        if b.returncode == 0:
            branch = b.stdout.strip()

        c = subprocess.run(
            ["git", "-C", clone_path, "rev-parse", "HEAD"],
            capture_output=True, text=True, timeout=5,
        )
        if c.returncode == 0:
            commit = c.stdout.strip()[:12]
    except Exception:
        pass
    return branch, commit


def _populate_meta(report: dict, repo_url: str, start: float, clone_path: str | None) -> dict:
    branch, commit = _get_git_info(clone_path)
    report["meta"] = {
        "repo": repo_url,
        "branch": branch,
        "commit": commit,
        "scanned_at": datetime.now(timezone.utc).isoformat(),
        "scan_duration_seconds": round(time.time() - start, 2),
        "model": settings.primary_model,
        "vigilagent_version": VIGILAGENT_VERSION,
    }
    return report


def _assign_ids(report: dict) -> dict:
    for i, f in enumerate(report["findings"].get("static_analysis", []), 1):
        f["id"] = f"SA-{i:03d}"
    for i, f in enumerate(report["findings"].get("dependency_audit", []), 1):
        f["id"] = f"DA-{i:03d}"
    for i, f in enumerate(report["findings"].get("secret_detection", []), 1):
        f["id"] = f"SD-{i:03d}"
    return report


def _error_report(repo_url: str, start: float, raw: str, error: str) -> dict:
    return {
        "meta": {
            "repo": repo_url,
            "branch": "unknown",
            "commit": "unknown",
            "scanned_at": datetime.now(timezone.utc).isoformat(),
            "scan_duration_seconds": round(time.time() - start, 2),
            "model": settings.primary_model,
            "vigilagent_version": VIGILAGENT_VERSION,
        },
        "summary": {
            "overall_severity": "ERROR",
            "total_findings": 0,
            "by_severity": {"critical": 0, "high": 0, "medium": 0, "low": 0},
            "by_category": {"static_analysis": 0, "dependency_audit": 0, "secret_detection": 0},
            "top_priority_finding": f"Report generation failed: {error}",
        },
        "findings": {
            "static_analysis": [],
            "dependency_audit": [],
            "secret_detection": [],
        },
        "ai_synthesis": {
            "executive_summary": "Report generation failed due to a JSON parsing error.",
            "critical_actions": [],
            "risk_assessment": "",
            "recommended_priority_order": [],
            "single_most_important_action": "",
            "finding_relationships": [],
            "scan_coverage_gaps": [],
            "clean_repo_context": "",
        },
        "parse_error": error,
        "raw_model_output": raw,
    }


def _save(report: dict, repo_url: str) -> Path:
    slug = re.sub(r"[^a-zA-Z0-9_.-]", "_", repo_url.strip("/").split("/")[-1])
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M-%S")
    settings.reports_dir.mkdir(parents=True, exist_ok=True)
    out_path = settings.reports_dir / f"{slug}_{ts}.json"
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return out_path


def _call_model(client: OpenAI, messages: list[dict]) -> str:
    resp = client.chat.completions.create(
        model=settings.primary_model,
        messages=messages,
        temperature=0.1,
        max_tokens=4096,  # 8192 exceeds many local models' context window
    )
    return resp.choices[0].message.content


# ── Prompts ────────────────────────────────────────────────────────────────────

# Scan results can be huge (thousands of semgrep findings). Truncate to keep
# the prompt within the model's context window.
_MAX_SCAN_JSON = 30_000


def _build_prompt(repo_url: str, scan_results: dict) -> str:
    scan_json = json.dumps(scan_results, indent=2)
    if len(scan_json) > _MAX_SCAN_JSON:
        scan_json = scan_json[:_MAX_SCAN_JSON] + "\n... [truncated — too many findings to fit in context]"

    return f"""Analyze the security scan results below for repository: {repo_url}

SCAN RESULTS (raw tool output):
{scan_json}

Populate the JSON schema below with findings extracted from the tool outputs above.

Rules:
- overall_severity: CRITICAL if any critical finding exists, else HIGH if any high, else MEDIUM, LOW, or CLEAN
- total_findings: exact count of all items across all three findings arrays
- by_severity and by_category counts must exactly match the findings arrays
- Include the most important findings — if results were truncated, prioritise high/critical severity
- Leave the "meta" object empty ({{}}) — it will be filled programmatically
- Do NOT include any "id" fields — they will be auto-assigned
- If a tool returned no findings, its array must be []

Per-finding enrichment fields (required for every finding):
- attack_scenario: 1-2 sentences describing a concrete, realistic exploitation path for this specific finding
- blast_radius: what data, systems, accounts, or access is at risk if exploited
- false_positive_likelihood: LOW (definitely real), MEDIUM (uncertain context), or HIGH (likely test/example code)
- false_positive_reasoning: one sentence explaining the confidence level
- verification_steps: 2-3 actionable steps a developer can run to confirm the fix worked

ai_synthesis enrichment fields:
- single_most_important_action: one decisive sentence — the single highest-priority action right now
- finding_relationships: group findings that share an attack vector or compound each other.
  Reference findings by their auto-assigned IDs: the Nth item in static_analysis is SA-N (1-indexed, 3-digit zero-padded, e.g. SA-001),
  Nth in dependency_audit is DA-N (DA-001...), Nth in secret_detection is SD-N (SD-001...).
  If no meaningful relationships exist, use an empty array.
- scan_coverage_gaps: list what semgrep/bandit, pip-audit/npm-audit, and gitleaks/trufflehog do NOT cover
  (e.g. runtime behavior, business logic flaws, auth flows, SSRF, race conditions, environment-injected secrets).
- clean_repo_context: if total_findings is 0, explain what "clean" means given these specific tools and what
  the developer should still consider. If total_findings > 0, set to empty string "".

- Return ONLY the JSON object. No markdown. No backticks. No explanation.

SCHEMA:
{SCHEMA}"""


def _build_retry_prompt(repo_url: str, scan_results: dict, bad_output: str, error: str) -> str:
    scan_json = json.dumps(scan_results, indent=2)
    if len(scan_json) > _MAX_SCAN_JSON:
        scan_json = scan_json[:_MAX_SCAN_JSON] + "\n... [truncated]"

    return f"""Your previous response failed JSON validation with this error: {error}

Failed output (first 500 chars): {bad_output[:500]}

Try again. Return ONLY a raw JSON object for repo {repo_url}.
No markdown fences, no backticks, no text before or after the JSON.
The JSON must have exactly these top-level keys: meta, summary, findings, ai_synthesis.

SCAN RESULTS:
{scan_json}

SCHEMA:
{SCHEMA}"""


# ── Public API ─────────────────────────────────────────────────────────────────

def synthesize_report(
    repo_url: str,
    scan_results: dict,
    clone_path: str | None = None,
) -> tuple[dict, str]:
    start = time.time()
    client = OpenAI(api_key=settings.llm_api_key, base_url=settings.llm_base_url)

    try:
        # ── First attempt ──────────────────────────────────────────────────────
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": _build_prompt(repo_url, scan_results)},
        ]
        raw = _call_model(client, messages)

        try:
            report = _parse_and_validate(raw)
        except Exception as e1:
            # ── Retry once with explicit correction prompt ──────────────────────
            retry_messages = [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": _build_retry_prompt(repo_url, scan_results, raw, str(e1))},
            ]
            raw2 = _call_model(client, retry_messages)
            try:
                report = _parse_and_validate(raw2)
            except Exception as e2:
                err = _error_report(repo_url, start, raw2, str(e2))
                saved = _save(err, repo_url)
                return err, saved.name

    except Exception as model_exc:
        # Model call itself failed (timeout, context overflow, Ollama error, etc.)
        # Always save an error report so the file appears in the reports tab.
        err = _error_report(repo_url, start, "", str(model_exc))
        saved = _save(err, repo_url)
        return err, saved.name

    # ── Post-processing: Python owns meta and IDs ─────────────────────────────
    report = _populate_meta(report, repo_url, start, clone_path)
    report = _assign_ids(report)

    saved = _save(report, repo_url)
    return report, saved.name
