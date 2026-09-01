@echo off
setlocal
set "SCRIPT=%~dp0uninstall.ps1"
echo AE Animation Manager BASIC uninstaller
echo.
if not exist "%SCRIPT%" goto missing
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"
set "EXITCODE=%ERRORLEVEL%"
echo.
if "%EXITCODE%"=="0" goto success
echo UNINSTALL FAILED. Exit code: %EXITCODE%
echo Please send a screenshot of the PowerShell error above.
goto end
:missing
echo UNINSTALL FAILED. uninstall.ps1 was not found next to this file.
goto end
:success
echo UNINSTALL COMPLETE. Fully restart After Effects.
:end
echo.
pause
endlocal
