"""Synthesize all scan results into a structured report using Nemotron."""
import json
from datetime import datetime, timezone
from pathlib import Path

from openai import OpenAI

from agent.config import settings


def _build_prompt(repo_url: str, scan_results: dict) -> str:
    summary = json.dumps(scan_results, indent=2)
    return f"""You are a senior application security engineer. Analyze the following automated security scan results for the repository: {repo_url}

SCAN RESULTS:
{summary}

Produce a structured security report with these sections:

## Executive Summary
A 2-3 sentence non-technical overview of the security posture.

## Critical Findings
List each critical/high severity issue with:
- Finding title
- Affected file/package
- Risk description
- Recommended remediation

## Medium Findings
Same structure as above for medium severity issues.

## Low / Informational Findings
Brief list only.

## Dependency Vulnerabilities
Summarize vulnerable dependencies with CVEs where available.

## Secrets & Credential Exposure
Any hardcoded secrets or credentials found, with severity.

## Risk Score
Overall risk score from 0-100 and a one-sentence justification.

## Remediation Priority
Ordered action items the team should address first.

Be precise, actionable, and avoid false positives. If a tool returned no findings, say so explicitly."""


def synthesize_report(repo_url: str, scan_results: dict) -> dict:
    client = OpenAI(
        api_key=settings.nvidia_api_key,
        base_url=settings.nvidia_base_url,
    )

    prompt = _build_prompt(repo_url, scan_results)

    response = client.chat.completions.create(
        model=settings.primary_model,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are VigilAgent, an expert autonomous security auditing system. "
                    "Produce clear, accurate, actionable security reports."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
        max_tokens=4096,
    )

    report_text = response.choices[0].message.content

    timestamp = datetime.now(timezone.utc).isoformat()
    # Filesystem-safe timestamp: YYYY-MM-DD_HH-MM-SS (colons invalid on some OSes)
    file_ts = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M-%S")
    report = {
        "repo_url": repo_url,
        "generated_at": timestamp,
        "model": settings.primary_model,
        "report": report_text,
        "raw_scan_results": scan_results,
    }

    # Persist to the sandbox reports directory
    slug = repo_url.strip("/").split("/")[-1]
    out_path: Path = settings.reports_dir / f"{slug}_{file_ts}.json"
    out_path.write_text(json.dumps(report, indent=2))

    return report
