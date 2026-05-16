from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    nvidia_api_key: str
    nvidia_base_url: str = "https://integrate.api.nvidia.com/v1"
    primary_model: str = "nvidia/nemotron-3-super-120b-a12b"
    subagent_model: str = "nvidia/nemotron-3-nano-30b-a3b"

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
