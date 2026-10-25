import { galatValidasi } from './galat.js';

/**
 * Kumpulan pembantu validasi input.
 *
 * Semua route memakai ini alih-alih meneruskan req.body apa adanya ke
 * database. Selain menolak data ngawur, ini juga mencegah pengguna
 * menyelipkan kolom yang tidak boleh mereka ubah (misal jumlah_dipinjam).
 */

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RE_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

export function teks(nilai, label, { wajib = false, maks = 255, min = 1 } = {}) {
  if (nilai === undefined || nilai === null || nilai === '') {
    if (wajib) throw galatValidasi(`${label} wajib diisi.`);
    return null;
  }
  if (typeof nilai !== 'string') throw galatValidasi(`${label} harus berupa teks.`);

  // PostgreSQL tidak bisa menyimpan byte NUL di kolom text sama sekali, jadi
  // ini harus ditolak di sini. Kalau diteruskan, yang muncul di layar adalah
  // "kesalahan server" — padahal sebabnya ada pada isian.
  if (nilai.includes('\u0000')) {
    throw galatValidasi(`${label} memuat karakter yang tidak bisa disimpan.`);
  }

  const bersih = nilai.trim();
  if (wajib && bersih.length < min) throw galatValidasi(`${label} wajib diisi.`);
  if (bersih.length > maks) throw galatValidasi(`${label} maksimal ${maks} karakter.`);
  return bersih || null;
}

export function bilangan(nilai, label, { wajib = false, min = 0, maks = 1_000_000, bawaan = null } = {}) {
  if (nilai === undefined || nilai === null || nilai === '') {
    if (wajib) throw galatValidasi(`${label} wajib diisi.`);
    return bawaan;
  }
  const angka = Number(nilai);
  if (!Number.isInteger(angka)) throw galatValidasi(`${label} harus berupa angka bulat.`);
  if (angka < min) throw galatValidasi(`${label} minimal ${min}.`);
  if (angka > maks) throw galatValidasi(`${label} maksimal ${maks}.`);
  return angka;
}

export function desimal(nilai, label, { min = 0, maks = 1e12 } = {}) {
  if (nilai === undefined || nilai === null || nilai === '') return null;
  const angka = Number(nilai);
  if (!Number.isFinite(angka)) throw galatValidasi(`${label} harus berupa angka.`);
  if (angka < min) throw galatValidasi(`${label} minimal ${min}.`);
  if (angka > maks) throw galatValidasi(`${label} terlalu besar.`);
  return angka;
}

/**
 * Membaca nilai benar/salah dari query string atau badan permintaan.
 *
 * Menerima "1"/"0" selain "true"/"false" karena itulah yang dikirim
 * tautan di aplikasi ini -- misalnya /admin/peminjaman?terlambat=1.
 * Sebelumnya hanya "true" yang dikenali, jadi saringan "Terlambat"
 * diam-diam tidak berlaku: halamannya tetap menampilkan SELURUH
 * pengajuan sambil menulis "N pengajuan yang terlambat dikembalikan",
 * termasuk yang sudah kembali dan yang dibatalkan.
 */
export function boolean(nilai, bawaan = null) {
  if (nilai === undefined || nilai === null || nilai === '') return bawaan;
  if (typeof nilai === 'boolean') return nilai;
  if (nilai === 'true' || nilai === '1') return true;
  if (nilai === 'false' || nilai === '0') return false;
  return bawaan;
}

export function uuid(nilai, label, { wajib = false } = {}) {
  if (nilai === undefined || nilai === null || nilai === '') {
    if (wajib) throw galatValidasi(`${label} wajib dipilih.`);
    return null;
  }
  if (typeof nilai !== 'string' || !RE_UUID.test(nilai)) {
    throw galatValidasi(`${label} tidak valid.`);
  }
  return nilai;
}

export function tanggal(nilai, label, { wajib = false } = {}) {
  if (nilai === undefined || nilai === null || nilai === '') {
    if (wajib) throw galatValidasi(`${label} wajib diisi.`);
    return null;
  }
  const teksTanggal = String(nilai).slice(0, 10);
  if (!RE_TANGGAL.test(teksTanggal)) throw galatValidasi(`${label} harus berformat YYYY-MM-DD.`);

  const waktu = new Date(`${teksTanggal}T00:00:00Z`);
  if (Number.isNaN(waktu.getTime())) throw galatValidasi(`${label} bukan tanggal yang benar.`);

  // Memeriksa NaN saja tidak cukup. JavaScript menggulung hari yang kelebihan
  // alih-alih menolaknya: "2027-02-31" diterima dan menjadi 3 Maret, lalu
  // teks aslinya ("2027-02-31") diteruskan ke PostgreSQL yang menolaknya
  // sebagai tanggal di luar jangkauan — pengguna hanya melihat "kesalahan
  // server". Membandingkan hasil parse dengan teks asal menutup celah itu:
  // bulan 13 dan hari 32 sudah tertangkap NaN, yang lolos justru 29-31
  // Februari dan 31 di bulan berisi 30 hari.
  if (waktu.toISOString().slice(0, 10) !== teksTanggal) {
    throw galatValidasi(`${label} bukan tanggal yang benar.`);
  }
  return teksTanggal;
}

export function pilihan(nilai, label, daftar, { wajib = false, bawaan = null } = {}) {
  if (nilai === undefined || nilai === null || nilai === '') {
    if (wajib) throw galatValidasi(`${label} wajib dipilih.`);
    return bawaan;
  }
  if (!daftar.includes(nilai)) {
    throw galatValidasi(`${label} harus salah satu dari: ${daftar.join(', ')}.`);
  }
  return nilai;
}

export function email(nilai, label = 'Email', { wajib = true } = {}) {
  const bersih = teks(nilai, label, { wajib, maks: 254 });
  if (!bersih) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(bersih)) {
    throw galatValidasi(`${label} tidak valid.`);
  }
  return bersih.toLowerCase();
}

export function nomorHp(nilai, label = 'Nomor HP', { wajib = false } = {}) {
  const bersih = teks(nilai, label, { wajib, maks: 20 });
  if (!bersih) return null;
  if (!/^[0-9+\s()-]{8,20}$/.test(bersih)) {
    throw galatValidasi(`${label} hanya boleh berisi angka, spasi, dan tanda + ( ) -.`);
  }
  return bersih;
}

/**
 * Menyiapkan kata kunci pencarian untuk operator ILIKE.
 *
 * Karakter % dan _ punya arti khusus di ILIKE, dan koma/tanda kurung
 * dipakai PostgREST sebagai pemisah filter. Semuanya dinetralkan di sini
 * supaya pencarian "50%" tidak berubah jadi wildcard atau merusak query.
 */
export function polaPencarian(nilai, { maks = 80 } = {}) {
  const bersih = teks(nilai, 'Kata kunci', { maks });
  if (!bersih) return null;
  const aman = bersih.replace(/[%_\\]/g, '\\$&').replace(/[,()]/g, ' ');
  return `%${aman}%`;
}

/** Membuang properti bernilai undefined agar tidak menimpa kolom saat UPDATE. */
export function tanpaUndefined(objek) {
  return Object.fromEntries(Object.entries(objek).filter(([, v]) => v !== undefined));
}
