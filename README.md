# VigilAgent

Security audit pipeline for GitHub repositories. Accepts a repo URL, runs a suite of CLI scanning tools, then feeds all findings to a local LLM to synthesize a structured report — end to end, no human intervention required.

---

## How it works

```
User: GitHub token + repo URL
          │
          ▼
    ┌─────────────┐
    │  FastAPI     │  POST /scan  →  queues a background job
    └──────┬──────┘
           │
           ▼
    ┌─────────────────────────────────────────────────┐
    │  LangGraph Pipeline (agent/orchestrator.py)     │
    │                                                 │
    │  Step 1 → git clone into sandbox               │
    │  Step 2 → semgrep + bandit (static analysis)   │
    │  Step 3 → pip-audit + npm audit (deps)         │
    │  Step 4 → gitleaks + trufflehog (secrets)      │
    │  Step 5 → LLM synthesizes findings → report    │
    └─────────────────────────────────────────────────┘
           │
           ▼
    reports/<repo>_<timestamp>.json
```

Steps 1–4 are plain Python functions that shell out to their respective CLI tools. No LLM is involved until Step 5, where all collected results are passed to `nemotron3-nano:30b` running locally via Ollama to generate the final report.

---

## Tech stack

| Layer | Technology |
|---|---|
| Pipeline runtime | LangGraph `StateGraph` (sequential) |
| Report model | `nemotron3-nano:30b` via Ollama (local) |
| API | FastAPI + Uvicorn |
| Frontend | React + Vite dashboard |
| Static analysis | semgrep, bandit |
| Dependency audit | pip-audit, npm audit |
| Secret detection | gitleaks, trufflehog |

---

## Project structure

```
VigilAgent/
├── agent/
│   ├── config.py           # Pydantic settings, reads .env
│   ├── orchestrator.py     # LangGraph pipeline (5 steps)
│   └── tools/
│       ├── clone.py        # Step 1: git clone into sandbox
│       ├── scan_static.py  # Step 2: semgrep + bandit
│       ├── scan_deps.py    # Step 3: pip-audit + npm audit
│       ├── scan_secrets.py # Step 4: gitleaks + trufflehog
│       └── report.py       # Step 5: LLM synthesis via Ollama
├── api/
│   └── main.py             # FastAPI endpoints
├── frontend/
│   └── src/                # React dashboard
├── policies/
│   └── vigilagent.yaml     # Sandbox policy
├── repos/                  # Sandboxed clone targets (gitignored)
├── reports/                # Output JSON reports (gitignored)
├── .env                    # Real config — never commit
├── .env.example            # Template — safe to commit
├── vigilagent.sh           # Launcher (Linux / macOS)
├── vigilagent.ps1          # Launcher (Windows)
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

---

## Quickstart — Windows

### 1. Install prerequisites

- [Python 3.11+](https://www.python.org/downloads/)
- [Node.js + npm](https://nodejs.org/)
- [Git](https://git-scm.com/)
- [Ollama for Windows](https://ollama.com/download/windows)
- gitleaks — download the Windows binary from [gitleaks releases](https://github.com/gitleaks/gitleaks/releases) and add it to your PATH
- trufflehog — download the Windows binary from [trufflehog releases](https://github.com/trufflesecurity/trufflehog/releases) and add it to your PATH

### 2. Pull the model

```powershell
ollama pull nemotron3-nano:30b
```

### 3. Clone and launch

```powershell
git clone <this-repo>
cd VigilAgent
.\vigilagent.ps1
```

On first run the script will create `.env`, set up the Python virtualenv, install frontend dependencies, and start both services.

> If PowerShell blocks the script, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once first.

---

## Quickstart — Linux / macOS

### 1. Install prerequisites

```bash
# Python, Node, git
sudo apt update && sudo apt install -y python3 python3-venv python3-pip nodejs npm git curl

# gitleaks
curl -sSfL https://github.com/gitleaks/gitleaks/releases/download/v8.21.2/gitleaks_8.21.2_linux_x64.tar.gz \
  | tar -xz -C /usr/local/bin gitleaks

# trufflehog
curl -sSfL https://raw.githubusercontent.com/trufflesecurity/trufflehog/main/scripts/install.sh \
  | sh -s -- -b /usr/local/bin

# Ollama
curl -fsSL https://ollama.com/install.sh | sh
```

### 2. Pull the model

```bash
ollama pull nemotron3-nano:30b
```

### 3. Clone and launch

```bash
git clone <this-repo>
cd VigilAgent
./vigilagent.sh
```

Press `Ctrl+C` to stop all services cleanly.

---

## Getting a GitHub Personal Access Token

GitHub tokens are entered in the dashboard UI — no config file needed.

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate a token with `repo` scope (or no scope for public repos only)
3. Add it as a profile in the VigilAgent dashboard

---

## API reference

### `GET /health`

```bash
curl http://localhost:8000/health
```

---

### `POST /scan`
Submit a scan job. Returns immediately with a `job_id`; pipeline runs in the background.

```bash
curl -X POST http://localhost:8000/scan \
  -H "Content-Type: application/json" \
  -d '{
    "github_token": "ghp_...",
    "repos": ["https://github.com/owner/repo"]
  }'
```

`status` progresses: `queued` → `running` → `completed` | `failed`

---

### `GET /scan/{job_id}` · `GET /scans` · `GET /reports` · `GET /reports/{filename}`

Standard REST endpoints — see `/docs` (FastAPI auto-docs) for full schema.

---

## Running with Docker

```bash
docker-compose up --build
```

- API → `http://localhost:8000`
- Frontend → `http://localhost:5173`
- Report files persist in named Docker volumes across restarts.

> Docker uses Linux-native binaries for gitleaks and trufflehog. For Windows development, run natively with `vigilagent.ps1` instead.

---

## Sandbox policy

All filesystem access is defined by `policies/vigilagent.yaml`:

- Repos cloned only into the configured `repos/` directory
- Reports written only to the configured `reports/` directory
- SSH keys, AWS credentials, and password files explicitly denied
- `rm -rf` and `sudo` blocked at the shell level

---

## Development notes

- The in-memory job store (`_jobs` in `api/main.py`) resets on server restart. Swap for Redis for persistence across restarts.
- The LangGraph pipeline runs steps sequentially. If cloning fails, the graph aborts early and skips remaining steps.
- The LLM is called only in the final synthesis step (`agent/tools/report.py`) at `temperature=0.2`.
- The `.venv/` and `.env` files are gitignored — never commit either.
