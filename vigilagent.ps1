# VigilAgent — Windows launcher
# Usage: .\vigilagent.ps1

$MODEL            = "nemotron3-nano:30b"
$GITLEAKS_VERSION = "8.21.2"
$ScriptDir        = Split-Path -Parent $MyInvocation.MyCommand.Path
$BinDir           = Join-Path $ScriptDir "bin"
$venvPath         = Join-Path $ScriptDir ".venv"
$venvActivate     = Join-Path $venvPath "Scripts\Activate.ps1"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor White
Write-Host "║   VigilAgent — Security Audit Platform           ║" -ForegroundColor White
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor White
Write-Host ""

# ── 1. Prerequisites ──────────────────────────────────────────────────────────
Write-Host "Checking prerequisites..." -ForegroundColor Cyan

New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
if ($env:PATH -notlike "*$BinDir*") { $env:PATH = "$BinDir;$env:PATH" }

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "  ERROR: git is not installed or not on PATH." -ForegroundColor Red
    Write-Host "  Download from: https://git-scm.com/download/win" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
Write-Host "  git        ready" -ForegroundColor Green

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "  ERROR: Python is not installed or not on PATH." -ForegroundColor Red
    Write-Host "  Download from: https://www.python.org/downloads/" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
Write-Host "  python     ready" -ForegroundColor Green

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "  ERROR: Node.js / npm is not installed or not on PATH." -ForegroundColor Red
    Write-Host "  Download from: https://nodejs.org/" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
Write-Host "  node/npm   ready" -ForegroundColor Green

# gitleaks — download to bin/ if not on PATH
if (-not (Get-Command gitleaks -ErrorAction SilentlyContinue)) {
    Write-Host "  gitleaks   not found — downloading v$GITLEAKS_VERSION to bin\..." -ForegroundColor Yellow
    Write-Host "             Starting download, please wait..." -ForegroundColor DarkGray
    $glUrl = "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_windows_x64.zip"
    $glZip = Join-Path $BinDir "gitleaks.zip"
    try {
        Invoke-WebRequest -Uri $glUrl -OutFile $glZip -UseBasicParsing
        Expand-Archive -Path $glZip -DestinationPath $BinDir -Force
        Remove-Item $glZip -ErrorAction SilentlyContinue
        Write-Host "  gitleaks   downloaded" -ForegroundColor Green
    } catch {
        Write-Host ""
        Write-Host "  ERROR: Could not download gitleaks automatically." -ForegroundColor Red
        Write-Host "  Download the Windows binary from: https://github.com/gitleaks/gitleaks/releases" -ForegroundColor Yellow
        Write-Host "  and place gitleaks.exe in your PATH or in the bin\ folder." -ForegroundColor Yellow
        Write-Host ""
        exit 1
    }
} else {
    Write-Host "  gitleaks   ready" -ForegroundColor Green
}

# trufflehog — download to bin/ if not on PATH
if (-not (Get-Command trufflehog -ErrorAction SilentlyContinue)) {
    Write-Host "  trufflehog not found — downloading latest to bin\..." -ForegroundColor Yellow
    Write-Host "             Starting download, please wait..." -ForegroundColor DarkGray
    $thUrl = "https://github.com/trufflesecurity/trufflehog/releases/latest/download/trufflehog_windows_amd64.zip"
    $thZip = Join-Path $BinDir "trufflehog.zip"
    try {
        Invoke-WebRequest -Uri $thUrl -OutFile $thZip -UseBasicParsing
        Expand-Archive -Path $thZip -DestinationPath $BinDir -Force
        Remove-Item $thZip -ErrorAction SilentlyContinue
        Write-Host "  trufflehog downloaded" -ForegroundColor Green
    } catch {
        Write-Host ""
        Write-Host "  ERROR: Could not download trufflehog automatically." -ForegroundColor Red
        Write-Host "  Download the Windows binary from: https://github.com/trufflesecurity/trufflehog/releases" -ForegroundColor Yellow
        Write-Host "  and place trufflehog.exe in your PATH or in the bin\ folder." -ForegroundColor Yellow
        Write-Host ""
        exit 1
    }
} else {
    Write-Host "  trufflehog ready" -ForegroundColor Green
}
Write-Host ""

# ── 2. .env — auto-create from example if missing ────────────────────────────
Write-Host "Checking environment..." -ForegroundColor Cyan
$envFile    = Join-Path $ScriptDir ".env"
$envExample = Join-Path $ScriptDir ".env.example"
if (-not (Test-Path $envFile)) {
    Copy-Item $envExample $envFile
    Write-Host "  No .env found — created from .env.example" -ForegroundColor Yellow
}
Write-Host "  .env ready" -ForegroundColor Green
Write-Host ""

# ── 3. Ollama — verify running and model present ──────────────────────────────
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
    Write-Host "  Starting download — this can take several minutes depending on your connection..." -ForegroundColor Yellow
    ollama pull $MODEL
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "  ERROR: Failed to pull '$MODEL'. Check your Ollama installation." -ForegroundColor Red
        Write-Host ""
        exit 1
    }
}
Write-Host "  Model '$MODEL' ready" -ForegroundColor Green
Write-Host ""

# ── 4. Python venv — create + install if missing ──────────────────────────────
Write-Host "Checking Python environment..." -ForegroundColor Cyan
if (-not (Test-Path $venvPath)) {
    Write-Host "  No virtual environment found — creating one now..." -ForegroundColor Yellow
    python -m venv $venvPath
    & $venvActivate
    Write-Host "  Downloading Python packages — this may take a few minutes on first run..." -ForegroundColor Yellow
    pip install -r (Join-Path $ScriptDir "requirements.txt")
    Write-Host "  Python environment ready" -ForegroundColor Green
} else {
    & $venvActivate
    Write-Host "  Python environment ready" -ForegroundColor Green
}
Write-Host ""

# ── 5. Node modules — install if missing ─────────────────────────────────────
Write-Host "Checking frontend dependencies..." -ForegroundColor Cyan
$nodeModules = Join-Path $ScriptDir "frontend\node_modules"
if (-not (Test-Path $nodeModules)) {
    Write-Host "  No node_modules found — downloading frontend packages, this may take a minute..." -ForegroundColor Yellow
    Push-Location (Join-Path $ScriptDir "frontend")
    npm install
    Pop-Location
    Write-Host "  Frontend dependencies ready" -ForegroundColor Green
} else {
    Write-Host "  Frontend dependencies ready" -ForegroundColor Green
}
Write-Host ""

# ── 6. Free ports if in use ───────────────────────────────────────────────────
foreach ($port in 8000, 5173) {
    $procId = (netstat -ano | Select-String ":$port " | ForEach-Object { ($_ -split '\s+')[-1] } | Select-Object -First 1)
    if ($procId -and $procId -match '^\d+$') {
        Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue
        Write-Host "  Cleared stale process on port $port" -ForegroundColor Yellow
    }
}

# ── 7. Start backend and frontend ─────────────────────────────────────────────
Write-Host "Starting FastAPI backend on port 8000..." -ForegroundColor Cyan
$backend = Start-Job -ScriptBlock {
    param($scriptDir, $binDir, $venvPath)
    if ($env:PATH -notlike "*$binDir*") { $env:PATH = "$binDir;$env:PATH" }
    Set-Location $scriptDir
    & "$venvPath\Scripts\uvicorn.exe" api.main:app --host 0.0.0.0 --port 8000
} -ArgumentList $ScriptDir, $BinDir, $venvPath

Start-Sleep -Seconds 2

Write-Host "Starting Vite frontend on port 5173..." -ForegroundColor Cyan
$frontend = Start-Job -ScriptBlock {
    param($scriptDir)
    Set-Location (Join-Path $scriptDir "frontend")
    npm run dev -- --host 0.0.0.0
} -ArgumentList $ScriptDir

Start-Sleep -Seconds 3

# ── 8. Resolve local IP ───────────────────────────────────────────────────────
$localIP = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.InterfaceAlias -notmatch "Loopback" -and $_.IPAddress -ne "127.0.0.1" } |
    Select-Object -First 1).IPAddress
if (-not $localIP) { $localIP = "localhost" }

# ── 9. Startup summary ────────────────────────────────────────────────────────
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
