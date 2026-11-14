@echo off
REM Starts the backend (port 8000) and frontend (port 3000) in two windows.
start "Enterprise Brain API" cmd /k "cd /d %~dp0backend && python -m uvicorn app.main:app --port 8000 --reload"
start "Enterprise Brain UI" cmd /k "cd /d %~dp0frontend && npm run dev"
echo Backend:  http://127.0.0.1:8000/api/docs
echo Frontend: http://localhost:3000
