"""Dependency vulnerability scanning: pip-audit + npm audit."""
import json
import subprocess
import sys
from pathlib import Path

_BIN = Path(sys.executable).parent


def _bin(name: str) -> str:
    p = _BIN / name
    return str(p) if p.exists() else name


def run_pip_audit(repo_path: str) -> dict:
    req_files = list(Path(repo_path).rglob("requirements*.txt"))
    pyproject = list(Path(repo_path).rglob("pyproject.toml"))

    if not req_files and not pyproject:
        return {"tool": "pip-audit", "findings": [], "error": None, "skipped": True}

    result = subprocess.run(
        [_bin("pip-audit"), "--format", "json", "-r", str(req_files[0])]
        if req_files
        else [_bin("pip-audit"), "--format", "json"],
        capture_output=True,
        text=True,
        timeout=180,
        cwd=repo_path,
    )

    try:
        data = json.loads(result.stdout)
        findings = data.get("dependencies", [])
        # Flatten to only vulnerable packages
        vulns = [
            {"package": dep["name"], "version": dep["version"], "vulns": dep["vulns"]}
            for dep in findings
            if dep.get("vulns")
        ]
    except json.JSONDecodeError:
        vulns = []

    return {
        "tool": "pip-audit",
        "findings": vulns,
        "error": result.stderr.strip() if result.returncode > 1 else None,
        "skipped": False,
    }


def run_npm_audit(repo_path: str) -> dict:
    pkg_files = list(Path(repo_path).rglob("package.json"))
    # Exclude node_modules
    pkg_files = [p for p in pkg_files if "node_modules" not in str(p)]

    if not pkg_files:
        return {"tool": "npm-audit", "findings": [], "error": None, "skipped": True}

    result = subprocess.run(
        ["npm", "audit", "--json"],
        capture_output=True,
        text=True,
        timeout=180,
        cwd=str(pkg_files[0].parent),
    )

    try:
        data = json.loads(result.stdout)
        vulns = data.get("vulnerabilities", {})
        findings = [
            {
                "package": name,
                "severity": info.get("severity"),
                "via": info.get("via", []),
                "range": info.get("range"),
            }
            for name, info in vulns.items()
        ]
    except json.JSONDecodeError:
        findings = []

    return {
        "tool": "npm-audit",
        "findings": findings,
        "error": result.stderr.strip() if result.returncode > 1 else None,
        "skipped": False,
    }


def scan_deps(repo_path: str) -> dict:
    pip = run_pip_audit(repo_path)
    npm = run_npm_audit(repo_path)

    return {
        "pip_audit": pip,
        "npm_audit": npm,
        "total_findings": len(pip["findings"]) + len(npm["findings"]),
    }
