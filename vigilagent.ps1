# VigilAgent — Windows launcher
# Usage: .\start.ps1

$MODEL = "nemotron3-nano:30b"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor White
Write-Host "║   VigilAgent — Security Audit Platform           ║" -ForegroundColor White
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor White
Write-Host ""

# ── 1. .env — auto-create from example if missing ────────────────────────────
Write-Host "Checking environment..." -ForegroundColor Cyan
$envFile = Join-Path $ScriptDir ".env"
$envExample = Join-Path $ScriptDir ".env.example"
if (-not (Test-Path $envFile)) {
    Copy-Item $envExample $envFile
    Write-Host "  No .env found — created from .env.example" -ForegroundColor Yellow
}
Write-Host "  .env ready" -ForegroundColor Green

# ── 2. Ollama — verify running and model present ──────────────────────────────
Write-Host "Checking Ollama..." -ForegroundColor Cyan
try {
    $null = Invoke-WebRequest -Uri "http://localhost:11434" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
    Write-Host "  Ollama is running" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "  ERROR: Ollama is not responding at http://localhost:11434" -ForegroundColor Red
    Write-Host "  Make sure Ollama is installed and the service is running." -ForegroundColor Red
    Write-Host "  Download from: https://ollama.com/download/windows" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

$modelList = ollama list 2>$null
if ($modelList -notmatch [regex]::Escape($MODEL)) {
    Write-Host "  Model '$MODEL' not found locally." -ForegroundColor Yellow
    Write-Host "  Pulling now (this may take a while on first run)..." -ForegroundColor Yellow
    ollama pull $MODEL
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: Failed to pull '$MODEL'." -ForegroundColor Red
        exit 1
    }
}
Write-Host "  Model '$MODEL' ready" -ForegroundColor Green
Write-Host ""

# ── 3. Python venv — create + install if missing ──────────────────────────────
Write-Host "Checking Python environment..." -ForegroundColor Cyan
$venvPath = Join-Path $ScriptDir ".venv"
$venvActivate = Join-Path $venvPath "Scripts\Activate.ps1"
if (-not (Test-Path $venvPath)) {
    Write-Host "  No virtualenv found — creating and installing dependencies..." -ForegroundColor Yellow
    python -m venv $venvPath
    & $venvActivate
    pip install -r (Join-Path $ScriptDir "requirements.txt") --quiet
    Write-Host "  Python environment ready" -ForegroundColor Green
} else {
    & $venvActivate
    Write-Host "  Python environment ready" -ForegroundColor Green
}

# ── 4. Node modules — install if missing ─────────────────────────────────────
Write-Host "Checking frontend dependencies..." -ForegroundColor Cyan
$nodeModules = Join-Path $ScriptDir "frontend\node_modules"
if (-not (Test-Path $nodeModules)) {
    Write-Host "  No node_modules found — installing frontend dependencies..." -ForegroundColor Yellow
    Push-Location (Join-Path $ScriptDir "frontend")
    npm install --silent
    Pop-Location
}
Write-Host "  Frontend dependencies ready" -ForegroundColor Green
Write-Host ""

# ── 5. Free ports if in use ───────────────────────────────────────────────────
foreach ($port in 8000, 5173) {
    $pid = (netstat -ano | Select-String ":$port " | ForEach-Object { ($_ -split '\s+')[-1] } | Select-Object -First 1)
    if ($pid -and $pid -match '^\d+$') {
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        Write-Host "  Cleared stale process on port $port" -ForegroundColor Yellow
    }
}

# ── 6. Start backend and frontend ─────────────────────────────────────────────
Write-Host "Starting FastAPI backend on port 8000..." -ForegroundColor Cyan
$backend = Start-Job -ScriptBlock {
    Set-Location $using:ScriptDir
    & "$using:venvPath\Scripts\uvicorn.exe" api.main:app --host 0.0.0.0 --port 8000
}

Start-Sleep -Seconds 2

Write-Host "Starting Vite frontend on port 5173..." -ForegroundColor Cyan
$frontend = Start-Job -ScriptBlock {
    Set-Location (Join-Path $using:ScriptDir "frontend")
    npm run dev -- --host 0.0.0.0
}

Start-Sleep -Seconds 3

# ── 7. Resolve local IP ───────────────────────────────────────────────────────
$localIP = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.InterfaceAlias -notmatch "Loopback" -and $_.IPAddress -ne "127.0.0.1" } |
    Select-Object -First 1).IPAddress
if (-not $localIP) { $localIP = "localhost" }

# ── 8. Startup summary ────────────────────────────────────────────────────────
Write-Host ""
Write-Host "══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  VigilAgent is live!" -ForegroundColor Green
Write-Host "══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  Dashboard    ->  http://${localIP}:5173" -ForegroundColor Cyan
Write-Host "  Backend API  ->  http://${localIP}:8000" -ForegroundColor Cyan
Write-Host "  API Docs     ->  http://${localIP}:8000/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Press Ctrl+C to stop all services."
Write-Host "══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""

# ── Keep alive, stream job output, stop on Ctrl+C ────────────────────────────
try {
    while ($true) {
        Receive-Job $backend, $frontend
        Start-Sleep -Seconds 1
    }
} finally {
    Write-Host ""
    Write-Host "Shutting down VigilAgent..." -ForegroundColor Yellow
    Stop-Job $backend, $frontend
    Remove-Job $backend, $frontend
    Write-Host "All services stopped." -ForegroundColor Green
}
