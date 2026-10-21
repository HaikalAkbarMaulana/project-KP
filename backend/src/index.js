/**
 * Menyalakan API sebagai server biasa.
 *
 * Dipakai saat pengembangan dan bila backend dijalankan di komputer/server
 * sekolah sendiri. Di Vercel berkas ini TIDAK dipakai — di sana aplikasinya
 * diambil langsung dari src/app.js lewat api/index.js, karena platform itu
 * yang mengurus soket dan portnya sendiri.
 */
import app, { konfigurasiKurang } from './app.js';
import { periksaSkema } from './lib/periksaSkema.js';

// Server lokal sengaja berhenti total bila konfigurasinya belum lengkap.
// Ini kesalahan pemasangan, dan lebih baik terlihat sekarang daripada
// nanti sebagai rentetan permintaan gagal yang membingungkan.
if (konfigurasiKurang.length) {
  console.error(
    `Konfigurasi belum lengkap. Isi dulu di backend/.env: ${konfigurasiKurang.join(', ')}\n` +
    'Contoh isiannya ada di backend/.env.example.'
  );
  process.exit(1);
}

const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, () => {
  console.log(`API berjalan di http://localhost:${PORT}`);
  // Sengaja tidak ditunggu: server tetap menyala walau pemeriksaan gagal,
  // supaya masalah koneksi tidak ikut menghalangi start.
  periksaSkema().catch((err) => console.warn('Pemeriksaan skema dilewati:', err.message));
});
