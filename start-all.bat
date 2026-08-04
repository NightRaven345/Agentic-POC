@echo off
echo ================================================================
echo    AI-Powered Government Portal Assistant (POC) Launcher
echo ================================================================
echo.
echo Starting 3 Tier Microservice Architecture:
echo   1. Spring Boot Backend (Port 8080)
echo   2. Python FastAPI AI Service (Port 8000)
echo   3. Angular Frontend (Port 4200)
echo.

start "Spring Boot Backend" cmd /k "cd backend && mvn spring-boot:run"
start "Python FastAPI AI Service" cmd /k "cd ai-backend && python -m uvicorn main:app --port 8000 --reload"
start "Angular Frontend" cmd /k "cd frontend && npm start"

echo All services launching in separate windows!
echo Open http://localhost:4200 in your browser.
pause
