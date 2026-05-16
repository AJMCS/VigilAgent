# VigilAgent

Autonomous GitHub security auditing agent built for the NVIDIA/ASUS 24-hour hackathon. Accepts a list of GitHub repositories, runs a full security scan pipeline, and synthesizes findings into a structured report — end to end, no human intervention required.

---

## How it works

```
User: GitHub token + repo URLs
          │
          ▼
    ┌─────────────┐
    │  FastAPI     │  POST /scan  →  queues a background job
    └──────┬──────┘
           │
           ▼
    ┌─────────────────────────────────────────────────┐
    │  LangGraph Orchestrator (agent/orchestrator.py) │
    │                                                 │
    │  Agent 1 → clone repo (sandboxed)               │
    │  Agent 2 → semgrep + bandit (static analysis)   │
    │  Agent 3 → pip-audit + npm audit (deps)         │
    │  Agent 4 → gitleaks + trufflehog (secrets)      │
    │  Agent 5 → Nemotron synthesis → report JSON     │
    └─────────────────────────────────────────────────┘
           │
           ▼
    reports/<repo>_<timestamp>.json   (sandbox output)
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Agent runtime | LangGraph `StateGraph` |
| Primary model | `nemotron-super` via Ollama (local) |
| Sub-agent model | `nemotron-mini` via Ollama (local) |
| API | FastAPI + Uvicorn |
| Frontend | React + Vite dashboard |
| Sandbox policy | NemoClaw + OpenShell YAML |
| Static analysis | semgrep, bandit |
| Dependency audit | pip-audit, npm audit |
| Secret detection | gitleaks, trufflehog |

---

## Project structure

```
VigilAgent/
├── agent/
│   ├── config.py           # Pydantic settings, reads .env
│   ├── orchestrator.py     # LangGraph pipeline (5 agents)
│   └── tools/
│       ├── clone.py        # Agent 1: git clone into sandbox
│       ├── scan_static.py  # Agent 2: semgrep + bandit
│       ├── scan_deps.py    # Agent 3: pip-audit + npm audit
│       ├── scan_secrets.py # Agent 4: gitleaks + trufflehog
│       └── report.py       # Agent 5: Nemotron synthesis via Ollama
├── api/
│   └── main.py             # FastAPI endpoints
├── frontend/
│   └── src/                # React dashboard
├── policies/
│   └── vigilagent.yaml     # NemoClaw sandbox policy
├── repos/                  # Sandboxed clone targets (gitignored)
├── reports/                # Output JSON reports (gitignored)
├── .env                    # Real config — never commit
├── .env.example            # Template — safe to commit
├── vigilagent.sh           # Single-command launcher
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

---

## Fresh Clone Quickstart (GX10 / Linux)

### 1. Install system prerequisites

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

### 2. Pull the Nemotron model

```bash
ollama pull nemotron-super
```

> This downloads the model weights. May take a few minutes on first run.

### 3. Clone the repo and launch

```bash
git clone <this-repo>
cd VigilAgent
./vigilagent.sh
```

That's it. On first run the script automatically:
- Creates `.env` from `.env.example` if it doesn't exist
- Starts Ollama if it isn't running
- Pulls `nemotron-super` if the model isn't downloaded yet
- Creates the Python virtualenv and installs dependencies
- Installs frontend Node modules
- Starts the FastAPI backend (port 8000) and Vite frontend (port 5173)
- Prints the LAN URLs you can open from any device on the same network

> If you need custom paths (e.g. non-root user), edit `.env` after the first run.

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

---

## Sandbox policy

All filesystem access is enforced by `policies/vigilagent.yaml`:

- Repos cloned only into `~/vigilagent/repos/`
- Reports written only to `~/vigilagent/reports/`
- SSH keys, AWS credentials, and password files explicitly denied
- `rm -rf` and `sudo` blocked at the shell level

---

## Deploying to ASUS Ascent GX10

All hardware-specific config lives in `.env`:

```env
HARDWARE_TARGET=ascent_gx10
GPU_DEVICE=0
REPOS_DIR=/root/vigilagent/repos
REPORTS_DIR=/root/vigilagent/reports
```

No code changes required — swap `.env` values and run `./vigilagent.sh`.

---

## Development notes

- The in-memory job store (`_jobs` in `api/main.py`) resets on server restart. Swap for Redis for persistence across restarts.
- The LangGraph pipeline runs agents sequentially. If cloning fails the graph aborts early.
- Nemotron is called only in the final synthesis step (`agent/tools/report.py`) at `temperature=0.2`.
- The `.venv/` and `.env` files are gitignored — never commit either.
