Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Starting Enterprise Brain (Backend & Frontend)..." -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$root = $PSScriptRoot
if (-not $root) { $root = "D:\OpenSource\enterprise-brain" }

# Start Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; python -m uvicorn app.main:app --port 8000 --reload"

# Start Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm run dev"

Write-Host "Launched:" -ForegroundColor Green
Write-Host "Backend API:  http://127.0.0.1:8000/api" -ForegroundColor Yellow
Write-Host "Frontend UI:  http://localhost:3000" -ForegroundColor Yellow

