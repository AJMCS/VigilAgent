"""Secret detection: gitleaks + trufflehog."""
import json
import os
import subprocess
import tempfile
from pathlib import Path


def run_gitleaks(repo_path: str) -> dict:
    # Write to a temp file — /dev/stdout doesn't exist on Windows
    tmp = tempfile.NamedTemporaryFile(suffix=".json", delete=False)
    tmp_path = tmp.name
    tmp.close()

    try:
        result = subprocess.run(
            [
                "gitleaks",
                "detect",
                "--source", repo_path,
                "--report-format", "json",
                "--report-path", tmp_path,
                "--no-git",
                "--exit-code", "0",  # don't fail the process on findings
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )

        try:
            with open(tmp_path, "r", encoding="utf-8") as f:
                content = f.read().strip()
            findings = json.loads(content) if content else []
        except (json.JSONDecodeError, FileNotFoundError):
            findings = []
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

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
    gitleaks   = run_gitleaks(repo_path)
    trufflehog = run_trufflehog(repo_path)

    return {
        "gitleaks":       gitleaks,
        "trufflehog":     trufflehog,
        "total_findings": len(gitleaks["findings"]) + len(trufflehog["findings"]),
    }
