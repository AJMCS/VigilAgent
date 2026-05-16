"""Secret detection: gitleaks + trufflehog."""
import json
import subprocess
from pathlib import Path


def run_gitleaks(repo_path: str) -> dict:
    result = subprocess.run(
        [
            "gitleaks",
            "detect",
            "--source", repo_path,
            "--report-format", "json",
            "--report-path", "/dev/stdout",
            "--no-git",
            "--exit-code", "0",  # don't fail the process on findings
        ],
        capture_output=True,
        text=True,
        timeout=120,
    )

    try:
        findings = json.loads(result.stdout) or []
    except json.JSONDecodeError:
        findings = []

    return {
        "tool": "gitleaks",
        "findings": findings,
        "error": result.stderr.strip() if result.returncode > 1 else None,
    }


def run_trufflehog(repo_path: str) -> dict:
    result = subprocess.run(
        [
            "trufflehog",
            "filesystem",
            repo_path,
            "--json",
            "--no-update",
        ],
        capture_output=True,
        text=True,
        timeout=180,
    )

    findings = []
    for line in result.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            findings.append(json.loads(line))
        except json.JSONDecodeError:
            continue

    return {
        "tool": "trufflehog",
        "findings": findings,
        "error": result.stderr.strip() if result.returncode > 1 else None,
    }


def scan_secrets(repo_path: str) -> dict:
    gitleaks = run_gitleaks(repo_path)
    trufflehog = run_trufflehog(repo_path)

    return {
        "gitleaks": gitleaks,
        "trufflehog": trufflehog,
        "total_findings": len(gitleaks["findings"]) + len(trufflehog["findings"]),
    }
