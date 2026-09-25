@echo off
setlocal
title LabPinjam - Menghentikan aplikasi

rem ======================================================================
rem  Mematikan backend dan frontend LabPinjam, di mana pun keduanya
rem  dinyalakan: dari jalankan-web.bat, dari terminal VS Code, atau dari
rem  proses yang jendelanya sudah tidak kelihatan.
rem
rem  Pakai ini kalau muncul error "EADDRINUSE" atau "port sudah dipakai".
rem ======================================================================

echo.
echo  Menghentikan LabPinjam...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\hentikan-web.ps1"
echo.
echo  Selesai. Jendela ini akan tertutup sendiri.
"%SystemRoot%\System32\timeout.exe" /t 5 >nul
