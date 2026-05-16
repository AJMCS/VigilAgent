from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Local LLM via Ollama (OpenAI-compatible endpoint)
    llm_base_url: str = "http://localhost:11434/v1"
    llm_api_key: str = "ollama"   # Ollama ignores this; OpenAI client requires it
    primary_model: str = "nemotron-super"
    subagent_model: str = "nemotron-mini"

    github_client_id: str = ""
    github_client_secret: str = ""

    repos_dir: Path = Path("/root/vigilagent/repos")
    reports_dir: Path = Path("/root/vigilagent/reports")

    hardware_target: str = "dev"
    gpu_device: int = 0

    api_host: str = "0.0.0.0"
    api_port: int = 8000

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

# Ensure sandbox dirs exist at import time
settings.repos_dir.mkdir(parents=True, exist_ok=True)
settings.reports_dir.mkdir(parents=True, exist_ok=True)
