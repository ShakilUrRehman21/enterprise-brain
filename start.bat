@echo off
echo ========================================================
echo Starting Enterprise Brain: Backend (FastAPI) & Frontend
echo ========================================================

start "Enterprise Brain - Backend API" cmd /k "cd /d %~dp0backend && python -m uvicorn app.main:app --port 8000 --reload"
start "Enterprise Brain - Frontend UI" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Both servers have been launched in separate console windows:
echo - Backend:  http://127.0.0.1:8000/api
echo - Frontend: http://localhost:3000
echo ========================================================
pause

