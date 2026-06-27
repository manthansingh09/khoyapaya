@echo off
title KhoyaPaya Command Center
echo Starting KhoyaPaya Command Center...
cd /d "%~dp0app"
python server.py
pause
