# Starts the backend (port 8000) and frontend (port 3000) in two windows.
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; python -m uvicorn app.main:app --port 8000 --reload"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm run dev"
Write-Host "Backend:  http://127.0.0.1:8000/api/docs"
Write-Host "Frontend: http://localhost:3000"
