@echo off
title UniNav - Campus Navigation System
echo =======================================================
echo  Starting Campus Navigation System (Backend + Frontend)
echo =======================================================

set "NODE_PATH=C:\Users\Srudeep\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.20.0-win-x64\node.exe"

if exist "%NODE_PATH%" (
    set "NODE_CMD=%NODE_PATH%"
) else (
    set "NODE_CMD=node"
)

cd /d "%~dp0backend"
start "" http://localhost:3000
"%NODE_CMD%" server.js

pause
