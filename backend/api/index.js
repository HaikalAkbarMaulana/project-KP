/**
 * Titik masuk API untuk Vercel.
 *
 * Vercel tidak menjalankan server yang hidup terus-menerus. Ia memanggil
 * fungsi ini tiap kali ada permintaan, jadi di sini TIDAK boleh ada
 * app.listen() — platformnya sendiri yang mengurus soket dan port.
 *
 * Aplikasi Express-nya sama persis dengan yang dipakai saat dijalankan di
 * komputer sendiri (src/index.js). Keduanya mengambil dari src/app.js,
 * sehingga tidak ada risiko perilaku berbeda antara yang diuji di komputer
 * dan yang berjalan online.
 */
import app from '../src/app.js';

export default function handler(req, res) {
  // Seluruh rute di dalam Express diawali "/api" (mis. /api/alat).
  //
  // Tergantung aturan rewrite yang dipakai, Vercel bisa menyerahkan jalur
  // yang sudah terpotong awalannya. Kalau itu terjadi dan dibiarkan,
  // Express tidak mengenali satu rute pun dan semuanya berakhir 404 —
  // kegagalan yang membingungkan karena kodenya sendiri tidak salah.
  //
  // Pemeriksaan di bawah membuat fungsi ini bekerja pada kedua bentuk.
  if (!req.url.startsWith('/api')) {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }

  return app(req, res);
}
