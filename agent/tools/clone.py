"""Clone a GitHub repo into the sandboxed repos directory."""
import re
import shutil
import subprocess
from pathlib import Path
from urllib.parse import urlparse

from agent.config import settings


def _safe_repo_slug(url: str) -> str:
    """Convert a GitHub URL to a filesystem-safe slug."""
    parsed = urlparse(url)
    slug = parsed.path.strip("/").replace("/", "__")
    slug = re.sub(r"[^a-zA-Z0-9_.-]", "_", slug)
    return slug


def clone_repo(github_token: str, repo_url: str) -> dict:
    """
    Clone *repo_url* into the NemoClaw-approved sandbox directory.

    Returns a dict with keys: slug, path, success, error.
    """
    slug = _safe_repo_slug(repo_url)
    dest: Path = settings.repos_dir / slug

    # Inject OAuth token into the HTTPS URL
    parsed = urlparse(repo_url)
    auth_url = parsed._replace(
        netloc=f"oauth2:{github_token}@{parsed.netloc}"
    ).geturl()

    # Remove stale clone if present
    if dest.exists():
        shutil.rmtree(dest)

    result = subprocess.run(
        ["git", "clone", "--depth", "1", auth_url, str(dest)],
        capture_output=True,
        text=True,
        timeout=120,
    )

    if result.returncode != 0:
        return {
            "slug": slug,
            "path": str(dest),
            "success": False,
            "error": result.stderr.strip(),
        }

    return {
        "slug": slug,
        "path": str(dest),
        "success": True,
        "error": None,
    }
