"""Static analysis: semgrep + bandit."""
import json
import subprocess
import sys
from pathlib import Path

# Resolve tools from the same bin directory as the running Python interpreter.
# This works whether the process was launched from an activated venv or not.
_BIN = Path(sys.executable).parent


def _bin(name: str) -> str:
    p = _BIN / name
    return str(p) if p.exists() else name


def run_semgrep(repo_path: str) -> dict:
    result = subprocess.run(
        [_bin("semgrep"), "--config", "auto", "--json", "--quiet", repo_path],
        capture_output=True,
        text=True,
        timeout=300,
    )
    try:
        data = json.loads(result.stdout)
        findings = data.get("results", [])
    except json.JSONDecodeError:
        findings = []

    return {
        "tool": "semgrep",
        "findings": findings,
        "error": result.stderr.strip() if result.returncode != 0 else None,
    }


def run_bandit(repo_path: str) -> dict:
    result = subprocess.run(
        [_bin("bandit"), "-r", repo_path, "-f", "json", "-q"],
        capture_output=True,
        text=True,
        timeout=180,
    )
    try:
        data = json.loads(result.stdout)
        findings = data.get("results", [])
    except json.JSONDecodeError:
        findings = []

    return {
        "tool": "bandit",
        "findings": findings,
        "error": result.stderr.strip() if result.returncode > 1 else None,
    }


def scan_static(repo_path: str) -> dict:
    path = Path(repo_path)
    semgrep = run_semgrep(str(path))

    py_files = list(path.rglob("*.py"))
    bandit = run_bandit(str(path)) if py_files else {"tool": "bandit", "findings": [], "error": None}

    return {
        "semgrep": semgrep,
        "bandit": bandit,
        "total_findings": len(semgrep["findings"]) + len(bandit["findings"]),
    }
