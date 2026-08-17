@echo off
echo ================================================================
echo    AI-Powered Government Portal Assistant (POC) Launcher
echo ================================================================
echo.
echo Starting 3 Tier Microservice Architecture:
echo   1. Spring Boot Backend (Port 8080)
echo   2. Spring AI Service (Port 8000)
echo   3. Web Frontend (Port 4200)
echo.

start "Spring Boot Backend" cmd /k "cd backend && mvn spring-boot:run"
start "Spring AI Service" cmd /k "set JAVA_HOME=C:\Users\APWRD-Server-VM02\.jdks\ms-21.0.12&& set PATH=C:\Users\APWRD-Server-VM02\.jdks\ms-21.0.12\bin;%PATH%&& cd ai-backend-spring && mvn spring-boot:run"
start "Web Frontend" cmd /k "cd frontend && python -m http.server 4200"

echo All services launching in separate windows!
echo Open http://localhost:4200 in your browser.
pause
