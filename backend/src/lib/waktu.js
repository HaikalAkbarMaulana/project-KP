/**
 * Tanggal menurut waktu setempat, bukan UTC.
 *
 * Sebelumnya beberapa tempat memakai `new Date().toISOString().slice(0, 10)`,
 * yang selalu memberi tanggal UTC. Indonesia bagian barat ada di UTC+7, jadi
 * antara 00:00 dan 07:00 WIB cara itu masih menyebut tanggal kemarin. Akibatnya
 * nyata dan terlihat pengguna:
 *
 *   - alat yang jatuh tempo kemarin baru ditandai terlambat setelah pukul 07:00;
 *   - kode pengajuan yang dibuat pagi hari bertanggal sehari sebelumnya
 *     (mis. PJM-20261005-… padahal sudah tanggal 6);
 *   - nama berkas laporan ikut bertanggal mundur.
 *
 * Zonanya bisa diatur lewat ZONA_WAKTU di .env bila sekolahnya ada di WITA
 * (Asia/Makassar) atau WIT (Asia/Jayapura).
 */

const ZONA = process.env.ZONA_WAKTU || 'Asia/Jakarta';

// Locale "sv-SE" dipilih karena format tanggal bakunya persis YYYY-MM-DD,
// sama dengan yang dipakai PostgreSQL, sehingga tidak perlu menyusun ulang
// potongan tanggalnya sendiri.
const PEMBENTUK = new Intl.DateTimeFormat('sv-SE', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Tanggal hari ini di zona setempat, sebagai "YYYY-MM-DD". */
export function tanggalLokal(waktu = new Date()) {
  return PEMBENTUK.format(waktu);
}

/** Tanggal setempat beberapa hari dari sekarang. Angka negatif berarti ke belakang. */
export function tanggalLokalGeser(selisihHari, waktu = new Date()) {
  return tanggalLokal(new Date(waktu.getTime() + selisihHari * 24 * 60 * 60 * 1000));
}

export const ZONA_WAKTU = ZONA;
