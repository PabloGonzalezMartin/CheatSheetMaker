$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1. Check .env
$envFile = "$ROOT\.env"
if (-not (Test-Path $envFile)) {
    Write-Host "ERROR: .env file not found. Copy .env.example to .env and fill in your values." -ForegroundColor Red
    exit 1
}
foreach ($line in Get-Content $envFile) {
    if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
    $parts = $line -split '=', 2
    $key   = $parts[0].Trim()
    $value = $parts[1].Trim().Trim('"').Trim("'")
    Set-Item -Path "Env:$key" -Value $value
}

# 2. Python venv setup — check common locations, then create if none found
$requirements = "$ROOT\backend\requirements.txt"
$venvPython   = $null
$venvPip      = $null

foreach ($candidate in @("$ROOT\.venv", "$ROOT\venv", "$ROOT\backend\venv", "$ROOT\backend\.venv")) {
    if (Test-Path "$candidate\Scripts\python.exe") {
        $venvPython = "$candidate\Scripts\python.exe"
        Write-Host "==> venv found at $candidate" -ForegroundColor Cyan
        break
    }
}

if (-not $venvPython) {
    $newVenvDir = "$ROOT\backend\venv"
    Write-Host "==> No venv found -- creating one at backend\venv..." -ForegroundColor Cyan

    $sysPython = $null
    foreach ($candidate in @("python", "python3")) {
        try {
            $ver = & $candidate --version 2>&1
            if ($ver -match "Python 3") { $sysPython = $candidate; break }
        } catch {}
    }
    if (-not $sysPython) {
        Write-Host "ERROR: Python 3 not found on PATH. Install Python 3.10+ and re-run." -ForegroundColor Red
        exit 1
    }

    Write-Host "    Using system python: $sysPython" -ForegroundColor Gray
    & $sysPython -m venv "$newVenvDir"
    if (-not (Test-Path "$newVenvDir\Scripts\python.exe")) {
        Write-Host "ERROR: venv creation failed." -ForegroundColor Red
        exit 1
    }
    $venvPython = "$newVenvDir\Scripts\python.exe"
    Write-Host "    venv created." -ForegroundColor Green
}

Write-Host "==> Installing/updating backend requirements..." -ForegroundColor Cyan
& $venvPython -m pip install --quiet --upgrade pip
& $venvPython -m pip install --quiet -r $requirements
Write-Host "    Requirements up to date." -ForegroundColor Green

# 3. Start DB
Write-Host "==> Starting DB (docker compose)..." -ForegroundColor Cyan
docker compose -f "$ROOT\docker-compose.yml" up -d db

Write-Host "==> Waiting for DB to be healthy..." -ForegroundColor Cyan
$retries = 20
for ($i = 0; $i -lt $retries; $i++) {
    $status = docker inspect --format "{{.State.Health.Status}}" cheatsheetmaker-db 2>$null
    if ($status -eq "healthy") {
        Write-Host "    DB is healthy." -ForegroundColor Green
        break
    }
    Write-Host "    ($($i+1)/$retries) status: $status -- waiting 3s..."
    Start-Sleep 3
    if ($i -eq ($retries - 1)) {
        Write-Host "ERROR: DB never became healthy." -ForegroundColor Red
        exit 1
    }
}

# 4. Start backend
Write-Host "==> Starting backend (uvicorn)..." -ForegroundColor Cyan
$backendProc = Start-Process `
    -FilePath $venvPython `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000" `
    -WorkingDirectory "$ROOT\backend" `
    -NoNewWindow -PassThru

# 5. Always run npm install to ensure dependencies are complete and up to date
Write-Host "==> Installing frontend dependencies (npm install)..." -ForegroundColor Cyan
$npmInstall = Start-Process `
    -FilePath "cmd.exe" `
    -ArgumentList "/c", "npm install" `
    -WorkingDirectory "$ROOT\frontend" `
    -NoNewWindow -PassThru -Wait
if ($npmInstall.ExitCode -ne 0) {
    Write-Host "ERROR: npm install failed." -ForegroundColor Red
    exit 1
}
Write-Host "    Frontend dependencies ready." -ForegroundColor Green

# 6. Start frontend
Write-Host "==> Starting frontend (next dev)..." -ForegroundColor Cyan
$frontendProc = Start-Process `
    -FilePath "cmd.exe" `
    -ArgumentList "/c", "npm run dev" `
    -WorkingDirectory "$ROOT\frontend" `
    -NoNewWindow -PassThru

Write-Host ""
Write-Host "Services running:" -ForegroundColor Green
Write-Host "  DB       -> localhost:5432"
Write-Host "  Backend  -> http://localhost:8000  (PID $($backendProc.Id))"
Write-Host "  Frontend -> http://localhost:3000  (PID $($frontendProc.Id))"
Write-Host ""
Write-Host "Press Ctrl+C to stop all..." -ForegroundColor Yellow

try {
    while ($true) { Start-Sleep 2 }
} finally {
    Write-Host ""
    Write-Host "==> Stopping processes..." -ForegroundColor Cyan
    if (-not $backendProc.HasExited)  { Stop-Process -Id $backendProc.Id  -Force }
    if (-not $frontendProc.HasExited) { Stop-Process -Id $frontendProc.Id -Force }
    Write-Host "==> Stopping DB..." -ForegroundColor Cyan
    docker compose -f "$ROOT\docker-compose.yml" stop db
    Write-Host "Done." -ForegroundColor Green
}
