#!/bin/bash
# VigilAgent — single-command launcher
# Usage: ./vigilagent.sh

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
DIM='\033[2m'
NC='\033[0m'

BACKEND_PID=""
FRONTEND_PID=""

# ── Graceful shutdown ──────────────────────────────────────────────────────────
cleanup() {
    echo ""
    echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "🛑  ${BOLD}Shutting down VigilAgent…${NC}"

    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null
        pkill -P "$BACKEND_PID" 2>/dev/null
        echo -e "    ✓ Backend stopped  ${DIM}(PID $BACKEND_PID)${NC}"
    fi

    if [ -n "$FRONTEND_PID" ]; then
        kill "$FRONTEND_PID" 2>/dev/null
        pkill -P "$FRONTEND_PID" 2>/dev/null
        echo -e "    ✓ Frontend stopped ${DIM}(PID $FRONTEND_PID)${NC}"
    fi

    wait 2>/dev/null
    echo ""
    echo -e "👋  ${BOLD}All services stopped. Goodbye!${NC}"
    echo ""
    exit 0
}

trap cleanup SIGINT SIGTERM

# ── Resolve script directory (works over SSH) ─────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Header ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   🛡️   VigilAgent — Security Audit Platform      ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ── 1. .env — auto-create from example if missing ─────────────────────────────
echo -e "🔧  Checking environment…"
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo -e "    ${YELLOW}No .env found — created from .env.example${NC}"
fi

# Always fix /root/ paths — /root/ is not writable by non-root users.
if grep -q "REPOS_DIR=/root" .env 2>/dev/null; then
    sed -i "s|REPOS_DIR=.*|REPOS_DIR=$SCRIPT_DIR/repos|" .env
    sed -i "s|REPORTS_DIR=.*|REPORTS_DIR=$SCRIPT_DIR/reports|" .env
    echo -e "    ${YELLOW}Sandbox paths updated to $SCRIPT_DIR${NC}"
fi
echo -e "${GREEN}✅  .env ready${NC}"

# ── 2. Ollama — start if not running, pull model if missing ───────────────────
echo -e "🤖  Checking Ollama…"

if ! curl -s --max-time 2 http://localhost:11434 > /dev/null 2>&1; then
    echo -e "    ${YELLOW}Ollama not running — starting it…${NC}"
    ollama serve > /dev/null 2>&1 &
    # Wait up to 15 seconds for Ollama to be ready
    for i in $(seq 1 15); do
        if curl -s --max-time 1 http://localhost:11434 > /dev/null 2>&1; then
            break
        fi
        sleep 1
    done
    if ! curl -s --max-time 2 http://localhost:11434 > /dev/null 2>&1; then
        echo ""
        echo -e "${RED}❌  Could not start Ollama. Is it installed?${NC}"
        echo ""
        echo -e "    Install with:  ${BOLD}curl -fsSL https://ollama.com/install.sh | sh${NC}"
        echo -e "    Then run:      ${BOLD}ollama run nemotron-mini${NC}"
        echo ""
        exit 1
    fi
    echo -e "${GREEN}✅  Ollama started${NC}"
else
    echo -e "${GREEN}✅  Ollama is running${NC}"
fi

# Pull the model if it isn't already downloaded
MODEL="nemotron-3-super"
if ! ollama list 2>/dev/null | grep -q "$MODEL"; then
    echo -e "    ${YELLOW}Model '$MODEL' not found — pulling now (first run only)…${NC}"
    if ! ollama pull "$MODEL"; then
        echo ""
        echo -e "${RED}❌  Failed to pull '$MODEL'. Check your Ollama installation.${NC}"
        echo ""
        exit 1
    fi
fi
echo -e "${GREEN}✅  Model '$MODEL' ready${NC}"
echo ""

# ── 3. Clear any stale processes on our ports ─────────────────────────────────
fuser -k 8000/tcp > /dev/null 2>&1 && echo -e "    ${YELLOW}Cleared stale process on port 8000${NC}"
fuser -k 5173/tcp > /dev/null 2>&1 && echo -e "    ${YELLOW}Cleared stale process on port 5173${NC}"

# ── 5. Python venv — create + install if missing ───────────────────────────────
if [ ! -d ".venv" ]; then
    echo -e "📦  No virtualenv found — creating and installing Python dependencies…"
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt --quiet
    echo -e "${GREEN}✅  Python environment ready${NC}"
else
    source .venv/bin/activate
    echo -e "${GREEN}✅  Python environment ready${NC}"
fi

# ── 4. Node modules — install if missing ──────────────────────────────────────
if [ ! -d "frontend/node_modules" ]; then
    echo -e "📦  No node_modules found — installing frontend dependencies…"
    (cd "$SCRIPT_DIR/frontend" && npm install --silent)
    echo -e "${GREEN}✅  Frontend dependencies ready${NC}"
else
    echo -e "${GREEN}✅  Frontend dependencies ready${NC}"
fi

echo ""

# ── 5. Start FastAPI backend ───────────────────────────────────────────────────
echo -e "🚀  Starting FastAPI backend on port 8000…"
uvicorn api.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo -e "    ${DIM}PID $BACKEND_PID${NC}"

sleep 2

# ── 6. Start Vite frontend ─────────────────────────────────────────────────────
echo -e "🌐  Starting Vite frontend on port 5173…"
(cd "$SCRIPT_DIR/frontend" && npm run dev -- --host 0.0.0.0) &
FRONTEND_PID=$!
echo -e "    ${DIM}PID $FRONTEND_PID${NC}"

sleep 3

# ── 7. Resolve local IP ────────────────────────────────────────────────────────
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP=$(ifconfig 2>/dev/null | grep 'inet ' | grep -v '127.0.0.1' | awk '{print $2}' | head -1)
fi
if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP="<your-machine-ip>"
fi

# ── 8. Startup summary ─────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}✅  VigilAgent is live!${NC}"
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  📊  Dashboard    →  ${BOLD}${CYAN}http://${LOCAL_IP}:5173${NC}"
echo -e "  ⚙️   Backend API  →  ${BOLD}${CYAN}http://${LOCAL_IP}:8000${NC}"
echo -e "  📖  API Docs     →  ${BOLD}${CYAN}http://${LOCAL_IP}:8000/docs${NC}"
echo ""
echo -e "  📡  ${YELLOW}Open the Dashboard URL on any device connected to the same WiFi.${NC}"
echo ""
echo -e "  Press ${BOLD}Ctrl+C${NC} to stop all services."
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ── Keep alive until Ctrl+C ────────────────────────────────────────────────────
wait
