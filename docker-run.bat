@echo off
title Build and Run Campus Navigation in Docker
echo ========================================================
echo  Building and Launching Campus Navigation Docker Image
echo ========================================================

docker compose up --build -d

if %errorlevel% neq 0 (
    echo [ERROR] Docker command failed. Please ensure Docker Desktop is running.
    pause
    exit /b %errorlevel%
)

echo.
echo ========================================================
echo  Container is running!
echo  Application URL: http://localhost:3000
echo  API Health:      http://localhost:3000/api/health
echo ========================================================
start "" http://localhost:3000
pause
