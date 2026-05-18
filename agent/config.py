from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Local LLM via Ollama (OpenAI-compatible endpoint)
    llm_base_url: str = "http://localhost:11434/v1"
    llm_api_key: str = "ollama"   # Ollama ignores this; OpenAI client requires it
    primary_model: str = "nemotron3-nano:30b"
    subagent_model: str = "nemotron3-nano:30b"

    github_client_id: str = ""
    github_client_secret: str = ""

    repos_dir: Path = Path(__file__).resolve().parent.parent / "repos"
    reports_dir: Path = Path(__file__).resolve().parent.parent / "reports"

    hardware_target: str = "dev"
    gpu_device: int = 0

    api_host: str = "0.0.0.0"
    api_port: int = 8000
    poll_interval_seconds: int = 300  # how often to check watched repos for new PRs

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

# Ensure sandbox dirs exist at import time
settings.repos_dir.mkdir(parents=True, exist_ok=True)
settings.reports_dir.mkdir(parents=True, exist_ok=True)
