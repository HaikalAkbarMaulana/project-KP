@echo off
setlocal EnableExtensions
title LabPinjam - Mode HP
cd /d "%~dp0"

rem ======================================================================
rem  Menyalakan aplikasi agar bisa dibuka dari HP yang tersambung ke
rem  Wi-Fi yang sama dengan komputer ini.
rem
rem  Bedanya dengan jalankan-web.bat: frontend dibuka untuk jaringan
rem  (npm run dev:hp), bukan hanya untuk komputer ini sendiri.
rem ======================================================================

echo.
echo  ==================================================
echo    LabPinjam - Mode HP
echo  ==================================================
echo.

where npm >nul 2>nul
if errorlevel 1 goto gagal_node
if not exist "backend\.env" goto gagal_env
if not exist "frontend\.env" goto gagal_env
if not exist "backend\node_modules\" goto gagal_pasang
if not exist "frontend\node_modules\" goto gagal_pasang

rem ---- Backend ---------------------------------------------------------
call :port_aktif 4000
if "%AKTIF%"=="1" goto backend_jalan
echo  [..] Menyalakan backend...
start "LabPinjam - Backend" /d "%~dp0backend" cmd /k npm run dev
goto cek_frontend
:backend_jalan
echo  [OK] Backend sudah berjalan.

rem ---- Frontend --------------------------------------------------------
:cek_frontend
call :port_aktif 5173
if "%AKTIF%"=="0" goto nyalakan_frontend

echo.
echo  [!] Frontend sudah berjalan, tapi mungkin dalam mode biasa yang
echo      TIDAK bisa dibuka dari HP.
echo      Tutup dulu jendela "LabPinjam - Frontend" atau klik dua kali
echo      hentikan-web.bat, lalu jalankan file ini lagi.
echo.
pause
exit /b 1

:nyalakan_frontend
echo  [..] Menyalakan frontend dalam mode jaringan...
start "LabPinjam - Frontend (mode HP)" /d "%~dp0frontend" cmd /k npm run dev:hp

echo  [..] Menunggu aplikasi siap...
set /a DETIK=0
:tunggu
call :port_aktif 4000
set BACKEND_AKTIF=%AKTIF%
call :port_aktif 5173
if "%BACKEND_AKTIF%%AKTIF%"=="11" goto siap
set /a DETIK+=1
if %DETIK% geq 90 goto terlalu_lama
"%SystemRoot%\System32\timeout.exe" /t 1 /nobreak >nul
goto tunggu

:siap
for /f "usebackq delims=" %%a in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\alamat-jaringan.ps1"`) do set ALAMAT=%%a

echo.
if "%ALAMAT%"=="" goto tanpa_alamat
echo  ==================================================
echo    Buka alamat ini di browser HP Anda:
echo.
echo        http://%ALAMAT%:5173
echo.
echo  ==================================================
echo.
echo  Syaratnya: HP tersambung ke Wi-Fi YANG SAMA dengan komputer ini.
goto penutup

:tanpa_alamat
echo  [!] Alamat jaringan tidak terbaca otomatis.
echo      Lihat baris "Network:" di jendela "LabPinjam - Frontend (mode HP)".

:penutup
echo.
echo  Jendela backend dan frontend harus tetap terbuka.
echo  Untuk mematikan: klik dua kali hentikan-web.bat
echo.
pause
exit /b 0

:terlalu_lama
echo.
echo  [!] Aplikasi belum siap setelah 90 detik. Lihat pesan error di
echo      jendela backend atau frontend.
goto akhir_gagal

:gagal_node
echo  [X] Node.js belum terpasang. Unduh dari https://nodejs.org
goto akhir_gagal

:gagal_env
echo  [X] Berkas .env belum lengkap. Jalankan jalankan-web.bat dulu.
goto akhir_gagal

:gagal_pasang
echo  [X] Dependensi belum terpasang. Klik dua kali jalankan-web.bat dulu.
goto akhir_gagal

:akhir_gagal
echo.
pause
exit /b 1

:port_aktif
set AKTIF=0
netstat -ano | findstr /R /C:":%~1 .*LISTENING" >nul && set AKTIF=1
exit /b 0
