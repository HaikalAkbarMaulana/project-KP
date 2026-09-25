@echo off
setlocal EnableExtensions
title LabPinjam - Menyalakan aplikasi
cd /d "%~dp0"

rem ======================================================================
rem  Menyalakan backend dan frontend LabPinjam, lalu membuka browser.
rem  Cukup klik dua kali file ini.
rem
rem  Server yang sudah menyala tidak dinyalakan dua kali, jadi file ini
rem  aman diklik ulang kapan saja.
rem ======================================================================

echo.
echo  ==================================================
echo    LabPinjam - Inventaris dan Peminjaman Alat Lab
echo    SMPN 3 Kedungreja
echo  ==================================================
echo.

rem ---- 1. Pemeriksaan awal ---------------------------------------------
where npm >nul 2>nul
if errorlevel 1 goto gagal_node

if not exist "backend\.env" goto gagal_env_backend
if not exist "frontend\.env" goto gagal_env_frontend

rem ---- 2. Pasang dependensi bila belum ada -----------------------------
if exist "backend\node_modules\" goto lewati_pasang_backend
echo  [..] Memasang dependensi backend. Hanya sekali, butuh internet...
call npm --prefix backend install --no-audit --no-fund
if errorlevel 1 goto gagal_pasang
:lewati_pasang_backend

if exist "frontend\node_modules\" goto lewati_pasang_frontend
echo  [..] Memasang dependensi frontend. Hanya sekali, butuh internet...
call npm --prefix frontend install --no-audit --no-fund
if errorlevel 1 goto gagal_pasang
:lewati_pasang_frontend

rem ---- 3. Backend -------------------------------------------------------
call :port_aktif 4000
if "%AKTIF%"=="1" goto backend_sudah_jalan
echo  [..] Menyalakan backend di jendela baru...
start "LabPinjam - Backend" /d "%~dp0backend" cmd /k npm run dev
goto lanjut_frontend
:backend_sudah_jalan
echo  [OK] Backend sudah berjalan di port 4000.
:lanjut_frontend

rem ---- 4. Frontend ------------------------------------------------------
call :port_aktif 5173
if "%AKTIF%"=="1" goto frontend_sudah_jalan
echo  [..] Menyalakan frontend di jendela baru...
start "LabPinjam - Frontend" /d "%~dp0frontend" cmd /k npm run dev
goto tunggu_siap
:frontend_sudah_jalan
echo  [OK] Frontend sudah berjalan di port 5173.

rem ---- 5. Tunggu keduanya siap, lalu buka browser ----------------------
:tunggu_siap
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
start "" "http://127.0.0.1:5173/"
echo.
echo  [OK] Aplikasi siap dan sudah dibuka di browser.
echo.
echo       Katalog alat : http://127.0.0.1:5173/
echo       Panel admin  : http://127.0.0.1:5173/admin/masuk
echo.
echo  Jendela "LabPinjam - Backend" dan "LabPinjam - Frontend" harus
echo  tetap terbuka selama aplikasi dipakai. Untuk mematikan aplikasi,
echo  tutup kedua jendela itu, atau klik dua kali hentikan-web.bat
echo.
echo  Jendela ini akan tertutup sendiri.
"%SystemRoot%\System32\timeout.exe" /t 15 >nul
exit /b 0

rem ---- Pesan kegagalan -------------------------------------------------
:terlalu_lama
echo.
echo  [!] Aplikasi belum siap setelah 90 detik.
echo      Baca pesan error di jendela "LabPinjam - Backend" atau
echo      "LabPinjam - Frontend".
goto akhir_gagal

:gagal_node
echo  [X] Node.js belum terpasang di komputer ini.
echo      Unduh versi LTS dari https://nodejs.org lalu klik file ini lagi.
goto akhir_gagal

:gagal_env_backend
echo  [X] File backend\.env belum ada.
echo      Salin backend\.env.example menjadi backend\.env lalu isi kunci
echo      Supabase-nya.
goto akhir_gagal

:gagal_env_frontend
echo  [X] File frontend\.env belum ada.
echo      Salin frontend\.env.example menjadi frontend\.env lalu isi kunci
echo      Supabase-nya.
goto akhir_gagal

:gagal_pasang
echo  [X] Pemasangan dependensi gagal. Periksa koneksi internet lalu
echo      klik file ini lagi.
goto akhir_gagal

:akhir_gagal
echo.
pause
exit /b 1

rem ---- Fungsi: apakah ada program yang mendengarkan di port %1? -------
rem  Spasi setelah nomor port mencegah port 40001 ikut terhitung 4000.
:port_aktif
set AKTIF=0
netstat -ano | findstr /R /C:":%~1 .*LISTENING" >nul && set AKTIF=1
exit /b 0
