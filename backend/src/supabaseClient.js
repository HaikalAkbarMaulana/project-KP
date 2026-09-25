import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Batas waktu tiap permintaan ke Supabase.
//
// Tanpa batas ini, bila komputer server tidak bisa menjangkau Supabase
// (Wi-Fi bermasalah, jaringan memblokir alamatnya), setiap permintaan
// menggantung hampir satu menit sebelum gagal — sementara di layar
// pengguna hanya melihat tulisan "Memuat..." yang tidak kunjung selesai.
//
// Jangan terlalu ketat: koneksi pertama setelah server menyala harus membuka
// jalur baru ke Supabase (region Sydney), dan lewat Wi-Fi yang lambat itu
// bisa lebih dari 8 detik meski koneksinya sebenarnya sehat. Permintaan
// berikutnya jauh lebih cepat (~1 detik) karena koneksinya sudah terbuka.
const BATAS_WAKTU_MS = Number(process.env.SUPABASE_TIMEOUT_MS) || 15_000;

/**
 * fetch dengan batas waktu yang benar-benar menghentikan permintaan.
 *
 * Sengaja TIDAK memakai AbortSignal.timeout(). Supabase JS mengulang
 * permintaan GET yang gagal hingga 3 kali (jeda 1, 2, lalu 4 detik), dan
 * satu-satunya kegagalan yang tidak diulang adalah error bernama
 * "AbortError". AbortSignal.timeout() menghasilkan "TimeoutError", sehingga
 * tiap percobaan ikut menunggu penuh — dengan batas 8 detik terukur 39 detik
 * sebelum pengguna mendapat kabar. abort() tanpa alasan menghasilkan
 * "AbortError", jadi batas waktunya berlaku untuk keseluruhan permintaan.
 *
 * Pengulangan untuk gangguan yang gagal cepat (misal koneksi terputus
 * sesaat) tetap berjalan seperti biasa.
 */
function fetchDenganBatasWaktu(url, opsi = {}) {
  const kontrol = new AbortController();
  const pewaktu = setTimeout(() => kontrol.abort(), BATAS_WAKTU_MS);

  const teruskanPembatalan = () => kontrol.abort();
  if (opsi.signal?.aborted) kontrol.abort();
  else opsi.signal?.addEventListener('abort', teruskanPembatalan, { once: true });

  // Pewaktu dihentikan begitu header balasan tiba. Sampai di titik itu
  // koneksinya terbukti sehat, dan membiarkan pewaktu tetap jalan justru
  // bisa memotong balasan besar yang masih sedang diunduh.
  return fetch(url, { ...opsi, signal: kontrol.signal }).finally(() => {
    clearTimeout(pewaktu);
    opsi.signal?.removeEventListener('abort', teruskanPembatalan);
  });
}

// Backend memakai service role key sehingga seluruh aturan RLS dilewati.
// Konsekuensinya, pemeriksaan hak akses SEPENUHNYA menjadi tanggung jawab
// middleware wajibAdmin dan validasi di tiap route — jangan pernah
// mengekspor klien ini ke frontend.
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: fetchDenganBatasWaktu },
  }
);
