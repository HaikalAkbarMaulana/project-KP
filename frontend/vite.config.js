import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,

    // Alamat IPv4 dipasang secara tegas, bukan "localhost".
    //
    // Di Windows, "localhost" bisa berarti ::1 (IPv6) maupun 127.0.0.1 (IPv4).
    // Vite hanya membuka port di alamat pertama yang ditemukan — di komputer
    // pengembangan ini ::1 — lalu tetap mencetak "http://localhost:5173".
    // Browser atau penampil yang mengetuk lewat IPv4 akhirnya mendapat
    // ERR_CONNECTION_REFUSED padahal servernya menyala. 127.0.0.1 selalu bisa
    // dijangkau, dan tidak ikut membuka akses ke jaringan Wi-Fi sekitar.
    host: '127.0.0.1',

    // Kalau 5173 sudah terpakai, Vite gagal dengan pesan jelas. Tanpa ini Vite
    // diam-diam pindah ke 5174, sementara jalankan-web.bat dan petunjuk di
    // README tetap mengarahkan browser ke 5173.
    strictPort: true,
  },
});
