/**
 * Kelas error yang pesannya aman ditampilkan ke pengguna.
 *
 * Error lain (misal error mentah dari Supabase) sengaja TIDAK diteruskan
 * apa adanya ke browser karena bisa membocorkan nama tabel/kolom. Lihat
 * penanganan terpusat di src/index.js.
 */
export class GalatAplikasi extends Error {
  constructor(pesan, status = 400) {
    super(pesan);
    this.name = 'GalatAplikasi';
    this.status = status;
    this.amanDitampilkan = true;
  }
}

export const PESAN_DATABASE_TAK_TERJANGKAU =
  'Server tidak bisa menghubungi database (Supabase). Periksa koneksi internet ' +
  'komputer yang menjalankan backend, lalu coba lagi.';

const RE_GANGGUAN_JARINGAN =
  /fetch failed|TimeoutError|AbortError|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|UND_ERR/i;

/**
 * Apakah kegagalan ini karena Supabase tidak terjangkau, bukan karena
 * datanya ditolak database.
 *
 * Supabase JS tidak melempar error jaringan, melainkan mengembalikannya
 * sebagai objek `error` biasa — bentuknya mirip error database, hanya
 * pesannya yang berbeda. Error dari PostgreSQL selalu membawa kode
 * SQLSTATE lima karakter (atau kode PGRST), jadi yang punya kode seperti
 * itu jelas bukan gangguan jaringan meskipun pesannya kebetulan memuat
 * kata "aborted".
 */
export function karenaDatabaseTakTerjangkau(error) {
  if (!error) return false;
  if (error.name === 'AuthRetryableFetchError') return true;
  if (typeof error.code === 'string' && /^([0-9A-Z]{5}|PGRST\w*)$/.test(error.code)) return false;

  const teks = [error.name, error.message, error.code, error.details, error.cause?.code]
    .filter(Boolean)
    .join(' ');
  return RE_GANGGUAN_JARINGAN.test(teks);
}

export const galatValidasi = (pesan) => new GalatAplikasi(pesan, 400);
export const galatTidakDitemukan = (pesan = 'Data tidak ditemukan.') => new GalatAplikasi(pesan, 404);
export const galatKonflik = (pesan) => new GalatAplikasi(pesan, 409);

/**
 * Menerjemahkan error PostgreSQL/PostgREST menjadi pesan berbahasa Indonesia
 * yang bisa dimengerti petugas lab. Kode error mengikuti daftar resmi
 * PostgreSQL: 23505 unique, 23503 foreign key, 23514 check constraint.
 */
export function terjemahkanGalatDatabase(error, konteks = {}) {
  if (!error?.code) return null;

  if (error.code === '23505') {
    const pesan = konteks.unik?.[tebakConstraint(error)] || 'Data dengan identitas yang sama sudah ada.';
    return galatKonflik(pesan);
  }

  if (error.code === '23503') {
    return galatKonflik(
      konteks.relasi || 'Data ini masih dipakai oleh data lain, jadi belum bisa dihapus.'
    );
  }

  if (error.code === '23514') {
    const nama = tebakConstraint(error);
    if (nama === 'cek_dipinjam_wajar' || nama === 'alat_jumlah_dipinjam_check') {
      return galatKonflik(
        'Jumlah yang dipinjam melebihi unit yang layak pakai. Segarkan halaman lalu periksa lagi stoknya.'
      );
    }
    if (nama === 'cek_urutan_tanggal') {
      return galatValidasi('Tanggal rencana kembali tidak boleh lebih awal dari tanggal pinjam.');
    }
    return galatValidasi('Data yang dikirim tidak memenuhi aturan yang berlaku.');
  }

  return null;
}

function tebakConstraint(error) {
  if (error.constraint) return error.constraint;
  const cocok = /constraint "([^"]+)"/.exec(error.message || error.details || '');
  return cocok?.[1] || '';
}
