@echo off
setlocal
set "BUILD=v1.4.1 basic-github-auto-update"
set "SCRIPT=%~dp0install.ps1"
echo AE Animation Manager BASIC installer
echo Build: %BUILD%
echo.
if not exist "%SCRIPT%" goto missing
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"
set "EXITCODE=%ERRORLEVEL%"
echo.
if "%EXITCODE%"=="0" goto success
echo INSTALL FAILED. Exit code: %EXITCODE%
echo Please send a screenshot of the PowerShell error above.
goto end
:missing
echo INSTALL FAILED. install.ps1 was not found next to this file.
goto end
:success
echo INSTALL COMPLETE. This is the stable BASIC edition without Agent functions.
echo Fully restart After Effects, then open Window - Extensions - AE Animation Manager (Basic).
:end
echo.
pause
endlocal
