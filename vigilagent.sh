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

# ── 1. Prerequisites ───────────────────────────────────────────────────────────
GITLEAKS_VERSION="8.21.2"
BIN_DIR="$SCRIPT_DIR/bin"
mkdir -p "$BIN_DIR"
export PATH="$BIN_DIR:$PATH"

echo -e "🔍  Checking prerequisites…"

# Helper: install a system package via apt
apt_install() {
    local pkg="$1"
    if command -v apt-get > /dev/null 2>&1; then
        sudo apt-get install -y "$pkg" > /dev/null 2>&1
        return $?
    fi
    return 1
}

# git
if ! command -v git > /dev/null 2>&1; then
    echo -e "    ${YELLOW}git not found — installing…${NC}"
    if ! apt_install git; then
        echo -e "${RED}❌  Could not install git automatically. Please install it and re-run.${NC}"
        exit 1
    fi
fi
echo -e "    ${GREEN}✓ git${NC}"

# python3
if ! command -v python3 > /dev/null 2>&1; then
    echo -e "    ${YELLOW}python3 not found — installing…${NC}"
    if ! apt_install "python3 python3-venv python3-pip"; then
        echo -e "${RED}❌  Could not install Python automatically. Please install it and re-run.${NC}"
        exit 1
    fi
fi
echo -e "    ${GREEN}✓ python3${NC}"

# node / npm
if ! command -v npm > /dev/null 2>&1; then
    echo -e "    ${YELLOW}node/npm not found — installing…${NC}"
    if ! apt_install "nodejs npm"; then
        echo -e "${RED}❌  Could not install Node.js automatically. Please install it and re-run.${NC}"
        exit 1
    fi
fi
echo -e "    ${GREEN}✓ node/npm${NC}"

# gitleaks — download binary to bin/ if not found
if ! command -v gitleaks > /dev/null 2>&1; then
    echo -e "    ${YELLOW}gitleaks not found — downloading v${GITLEAKS_VERSION} to bin/…${NC}"
    echo -e "    ${DIM}Starting download, please wait…${NC}"
    if ! curl -sSfL \
        "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz" \
        | tar -xz -C "$BIN_DIR" gitleaks; then
        echo -e "${RED}❌  Failed to download gitleaks. Check your internet connection and re-run.${NC}"
        exit 1
    fi
fi
echo -e "    ${GREEN}✓ gitleaks${NC}"

# trufflehog — download binary to bin/ if not found
if ! command -v trufflehog > /dev/null 2>&1; then
    echo -e "    ${YELLOW}trufflehog not found — downloading latest to bin/…${NC}"
    echo -e "    ${DIM}Starting download, please wait…${NC}"
    if ! curl -sSfL https://raw.githubusercontent.com/trufflesecurity/trufflehog/main/scripts/install.sh \
        | sh -s -- -b "$BIN_DIR" > /dev/null 2>&1; then
        echo -e "${RED}❌  Failed to download trufflehog. Check your internet connection and re-run.${NC}"
        exit 1
    fi
fi
echo -e "    ${GREEN}✓ trufflehog${NC}"

echo -e "${GREEN}✅  All prerequisites ready${NC}"
echo ""

# ── 2. .env — auto-create from example if missing ─────────────────────────────
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

# ── 3. Ollama — start if not running, pull model if missing ───────────────────
echo -e "🤖  Checking Ollama…"

if ! curl -s --max-time 2 http://localhost:11434 > /dev/null 2>&1; then
    echo -e "    ${YELLOW}Ollama not running — starting it…${NC}"
    ollama serve > /dev/null 2>&1 &
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
        echo ""
        exit 1
    fi
    echo -e "${GREEN}✅  Ollama started${NC}"
else
    echo -e "${GREEN}✅  Ollama is running${NC}"
fi

MODEL="nemotron3-nano:30b"
if ! ollama list 2>/dev/null | grep -q "$MODEL"; then
    echo -e "    ${YELLOW}Model '$MODEL' not found locally.${NC}"
    echo -e "    ${YELLOW}Starting download — this can take several minutes depending on your connection…${NC}"
    if ! ollama pull "$MODEL"; then
        echo ""
        echo -e "${RED}❌  Failed to pull '$MODEL'. Check your Ollama installation.${NC}"
        echo ""
        exit 1
    fi
fi
echo -e "${GREEN}✅  Model '$MODEL' ready${NC}"
echo ""

# ── 4. Clear any stale processes on our ports ─────────────────────────────────
fuser -k 8000/tcp > /dev/null 2>&1 && echo -e "    ${YELLOW}Cleared stale process on port 8000${NC}"
fuser -k 5173/tcp > /dev/null 2>&1 && echo -e "    ${YELLOW}Cleared stale process on port 5173${NC}"

# ── 5. Python venv — create + install if missing ──────────────────────────────
if [ ! -d ".venv" ]; then
    echo -e "📦  No virtual environment found — creating one now…"
    python3 -m venv .venv
    source .venv/bin/activate
    echo -e "    ${YELLOW}Downloading Python packages — this may take a few minutes on first run…${NC}"
    pip install -r requirements.txt
    echo -e "${GREEN}✅  Python environment ready${NC}"
else
    source .venv/bin/activate
    echo -e "${GREEN}✅  Python environment ready${NC}"
fi

# ── 6. Node modules — install if missing ──────────────────────────────────────
if [ ! -d "frontend/node_modules" ]; then
    echo -e "📦  No node_modules found — downloading frontend packages, this may take a minute…"
    (cd "$SCRIPT_DIR/frontend" && npm install)
    echo -e "${GREEN}✅  Frontend dependencies ready${NC}"
else
    echo -e "${GREEN}✅  Frontend dependencies ready${NC}"
fi

echo ""

# ── 7. Start FastAPI backend ───────────────────────────────────────────────────
echo -e "🚀  Starting FastAPI backend on port 8000…"
uvicorn api.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo -e "    ${DIM}PID $BACKEND_PID${NC}"

sleep 2

# ── 8. Start Vite frontend ─────────────────────────────────────────────────────
echo -e "🌐  Starting Vite frontend on port 5173…"
(cd "$SCRIPT_DIR/frontend" && npm run dev -- --host 0.0.0.0) &
FRONTEND_PID=$!
echo -e "    ${DIM}PID $FRONTEND_PID${NC}"

sleep 3

# ── 9. Resolve local IP ────────────────────────────────────────────────────────
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP=$(ifconfig 2>/dev/null | grep 'inet ' | grep -v '127.0.0.1' | awk '{print $2}' | head -1)
fi
if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP="<your-machine-ip>"
fi

# ── 10. Startup summary ────────────────────────────────────────────────────────
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
