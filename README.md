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
    reports/<repo>_<date>.json   (sandbox output)
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Agent runtime | LangGraph `StateGraph` |
| Primary model | `nvidia/nemotron-3-super-120b-a12b` via NVIDIA NIM |
| Sub-agent model | `nvidia/nemotron-3-nano-30b-a3b` |
| API | FastAPI + Uvicorn |
| Frontend | React (coming soon) |
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
│       └── report.py       # Agent 5: Nemotron synthesis
├── api/
│   └── main.py             # FastAPI endpoints
├── frontend/
│   └── src/                # React dashboard (WIP)
├── policies/
│   └── vigilagent.yaml     # NemoClaw sandbox policy
├── repos/                  # Sandboxed clone targets (gitignored)
├── reports/                # Output JSON reports (gitignored)
├── .env                    # Real secrets — never commit
├── .env.example            # Template — safe to commit
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

---

## Prerequisites

| Tool | Install |
|---|---|
| Python 3.12+ | [python.org](https://python.org) or `brew install python` |
| git | pre-installed on macOS |
| semgrep | `pip install semgrep` |
| bandit | `pip install bandit` |
| pip-audit | `pip install pip-audit` |
| Node / npm | `brew install node` (for npm audit) |
| gitleaks | `brew install gitleaks` |
| trufflehog | `brew install trufflesecurity/trufflehog/trufflehog` |

All of the above are baked into the Docker image automatically.

---

## Setup

### 1. Clone and create the virtualenv

```bash
git clone <this-repo>
cd VigilAgent
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in:

```env
NVIDIA_API_KEY=nvapi-...        # from build.nvidia.com (see below)
GITHUB_CLIENT_ID=...            # optional, for OAuth flow
GITHUB_CLIENT_SECRET=...        # optional, for OAuth flow
```

Everything else has safe defaults for local dev.

**Getting an NVIDIA API key:**
1. Go to [build.nvidia.com](https://build.nvidia.com)
2. Sign in → click any model (e.g. Nemotron Super)
3. Click **Get API Key** in the top right

**Getting a GitHub Personal Access Token (for scanning):**
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate a token with `repo` scope
3. Pass it in the `github_token` field of the `/scan` request body

### 3. Start the API server

```bash
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

---

## API reference

### `GET /health`
Liveness check.

```bash
curl http://localhost:8000/health
# {"status":"ok","model":"nvidia/nemotron-3-super-120b-a12b"}
```

---

### `POST /scan`
Submit a scan job. Returns immediately with a `job_id`; the pipeline runs in the background.

```bash
curl -X POST http://localhost:8000/scan \
  -H "Content-Type: application/json" \
  -d '{
    "github_token": "ghp_...",
    "repos": [
      "https://github.com/owner/repo1",
      "https://github.com/owner/repo2"
    ]
  }'
```

Response `202 Accepted`:
```json
{
  "job_id": "3f2a1b...",
  "status": "queued",
  "created_at": "2026-05-16T00:00:00Z",
  "repos": ["https://github.com/owner/repo1"],
  "results": null,
  "error": null
}
```

---

### `GET /scan/{job_id}`
Poll for job status and results.

```bash
curl http://localhost:8000/scan/3f2a1b...
```

`status` progresses: `queued` → `running` → `completed` | `failed`

When `completed`, `results` contains one entry per repo with the full Nemotron-synthesized report.

---

### `GET /scans`
List all jobs in the current server session.

```bash
curl http://localhost:8000/scans
```

---

### `GET /reports`
List persisted report files in the `reports/` sandbox directory.

```bash
curl http://localhost:8000/reports
```

---

## Running with Docker

```bash
docker-compose up --build
```

- API → `http://localhost:8000`
- Frontend → `http://localhost:3000`
- Report files persist in named Docker volumes across restarts.

---

## Sandbox policy

All filesystem access is enforced by `policies/vigilagent.yaml`:

- Repos may only be cloned into `~/vigilagent/repos/`
- Reports may only be written to `~/vigilagent/reports/`
- SSH keys, AWS credentials, and password files are explicitly denied
- `rm -rf` and `sudo` are blocked at the shell level

---

## Deploying to ASUS Ascent GX10

All hardware-specific config lives in `.env`. When switching targets:

```env
HARDWARE_TARGET=ascent_gx10
GPU_DEVICE=0
REPOS_DIR=/root/vigilagent/repos
REPORTS_DIR=/root/vigilagent/reports
```

No code changes required — just swap the `.env` values.

---

## Development notes

- The in-memory job store (`_jobs` dict in `api/main.py`) resets on server restart. Swap for Redis for persistence.
- The LangGraph pipeline runs agents sequentially (clone → static → deps → secrets → report). If the clone fails the graph aborts early.
- Nemotron is called only in the final report synthesis step (`agent/tools/report.py`) with `temperature=0.2` for deterministic output.
- The `.venv/` directory and `.env` file are gitignored — never commit either.
