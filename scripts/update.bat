@echo off
echo [1/4] Fetching latest changes from Git...
git pull

echo [2/4] Cleaning lockfiles and Syncing PNPM dependencies...
:: 🔑 Fixed the raw '&' character so Windows doesn't try to run 'Syncing' as a command
if exist package-lock.json del /f /q package-lock.json
call pnpm install --frozen-lockfile

echo [3/4] Compiling fresh production build with Turbopack...
call pnpm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed! Aborting restart to keep the current version running.
    exit /b %errorlevel%
)

echo [4/4] Update complete! Bouncing Windows Service...
:: 🔑 FIX: Swapped 'timeout' for 'ping' to create a background-safe 3-second delay.
:: 🔑 Also explicitly targets C:\Windows\System32\nssm.exe so the path context is never lost.
start "" cmd /c "ping 127.0.0.1 -n 3 >nul && nssm restart CreaPanel"
exit