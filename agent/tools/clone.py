"""Clone a GitHub repo into the sandboxed repos directory."""
import os
import re
import shutil
import stat
import subprocess
from pathlib import Path
from urllib.parse import urlparse

from agent.config import settings


def _safe_repo_slug(url: str, branch: str | None = None) -> str:
    parsed = urlparse(url)
    slug = parsed.path.strip("/").replace("/", "__")
    slug = re.sub(r"[^a-zA-Z0-9_.-]", "_", slug)
    if branch:
        safe_branch = re.sub(r"[^a-zA-Z0-9_.-]", "_", branch)
        slug = f"{slug}__{safe_branch}"
    return slug


def _rmtree(path: Path) -> None:
    """Remove a directory tree, handling Windows read-only / locked files."""
    def _on_error(func, fpath, _exc_info):
        # Make the file writable and retry — handles Windows read-only files
        # and some antivirus-held handles
        try:
            os.chmod(fpath, stat.S_IWRITE)
            func(fpath)
        except Exception:
            pass  # best-effort; if it still fails, rmtree will raise

    shutil.rmtree(str(path), onerror=_on_error)


def clone_repo(github_token: str, repo_url: str, branch: str | None = None) -> dict:
    """
    Clone *repo_url* into the sandbox directory.

    Pass *branch* to check out a specific branch or PR head
    (e.g. ``branch="refs/pull/42/head"`` for PR #42).

    Returns a dict with keys: slug, path, success, error.
    """
    slug = _safe_repo_slug(repo_url, branch)
    dest: Path = settings.repos_dir / slug

    parsed   = urlparse(repo_url)
    auth_url = parsed._replace(
        netloc=f"oauth2:{github_token}@{parsed.netloc}"
    ).geturl()

    if dest.exists():
        _rmtree(dest)

    if branch:
        clone_cmd = ["git", "clone", "--depth", "1", auth_url, str(dest)]
        result = subprocess.run(clone_cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            return {"slug": slug, "path": str(dest), "success": False, "error": result.stderr.strip()}

        fetch_cmd = ["git", "-C", str(dest), "fetch", "--depth", "1", "origin", branch]
        result = subprocess.run(fetch_cmd, capture_output=True, text=True, timeout=60)
        if result.returncode != 0:
            return {"slug": slug, "path": str(dest), "success": False, "error": result.stderr.strip()}

        checkout_cmd = ["git", "-C", str(dest), "checkout", "FETCH_HEAD"]
        result = subprocess.run(checkout_cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            return {"slug": slug, "path": str(dest), "success": False, "error": result.stderr.strip()}
    else:
        result = subprocess.run(
            ["git", "clone", "--depth", "1", auth_url, str(dest)],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode != 0:
            return {"slug": slug, "path": str(dest), "success": False, "error": result.stderr.strip()}

    # Remove the embedded credential from .git/config so secret scanners
    # (gitleaks, trufflehog) don't flag our own clone token as a leak.
    subprocess.run(
        ["git", "-C", str(dest), "remote", "set-url", "origin", repo_url],
        capture_output=True, timeout=10,
    )

    return {"slug": slug, "path": str(dest), "success": True, "error": None}
