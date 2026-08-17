@echo off
start "" cmd /c "ping 127.0.0.1 -n 3 >nul && nssm restart CreaPanel"
exit
