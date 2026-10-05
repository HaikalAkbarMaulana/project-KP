import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,

    // Dibuka di seluruh alamat IPv4 komputer ini, bukan hanya 127.0.0.1.
    //
    // Dengan begitu "npm run dev" langsung mencetak dua baris sekaligus:
    //   Local   -> untuk dibuka di komputer ini
    //   Network -> untuk dibuka dari HP di Wi-Fi yang sama
    //
    // Tetap ditulis 0.0.0.0 secara tegas, bukan dibiarkan kosong. Bawaan
    // Vite mengikuti "localhost", yang di Windows bisa berarti ::1 (IPv6)
    // saja — dan penampil yang mengetuk lewat IPv4 akan mendapat
    // ERR_CONNECTION_REFUSED padahal servernya menyala.
    //
    // Konsekuensinya aplikasi ikut terbuka bagi perangkat lain di Wi-Fi
    // yang sama selama server menyala. Untuk jaringan umum, matikan server
    // bila sudah selesai dipakai.
    host: '0.0.0.0',

    // Kalau 5173 sudah terpakai, Vite gagal dengan pesan jelas. Tanpa ini Vite
    // diam-diam pindah ke 5174, sementara jalankan-web.bat dan petunjuk di
    // README tetap mengarahkan browser ke 5173.
    strictPort: true,
  },
});
