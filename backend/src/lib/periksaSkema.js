import { supabaseAdmin } from '../supabaseClient.js';
import { karenaDatabaseTakTerjangkau } from './galat.js';

/**
 * Memastikan database terjangkau dan sudah memakai skema v2.
 *
 * Backend v2 menanyakan kolom yang belum ada di skema lama (profil.aktif,
 * alat.jumlah_baik, peminjaman.nama_peminjam). Tanpa pemeriksaan ini,
 * kegagalannya muncul jauh dari sumbernya: permintaan gagal dengan pesan
 * umum, dan di layar login terbaca seolah-olah akunnya yang bermasalah.
 * Lebih baik diberi tahu sekali dengan jelas saat server dinyalakan.
 */
const KOLOM_WAJIB = [
  { tabel: 'profil', kolom: 'aktif' },
  { tabel: 'alat', kolom: 'jumlah_baik' },
  { tabel: 'peminjaman', kolom: 'nama_peminjam' },
];

/**
 * Fungsi database yang dipanggil backend lewat RPC.
 *
 * Kolom yang hilang ketahuan dari pesan galat PostgreSQL, tapi fungsi yang
 * hilang tidak: permintaannya cuma gagal, dan di layar terbaca "Terjadi
 * kesalahan pada server" tanpa petunjuk apa pun.
 *
 * Itu benar-benar terjadi. catat_pengembalian sempat dibuat langsung di
 * database tanpa ikut ditulis ke schema.sql, jadi ketika aplikasi dipasang
 * ulang di proyek Supabase baru seluruh tabel terbentuk tapi pencatatan
 * pengembalian gagal — dan tidak ada satu pun pemeriksaan yang menangkapnya
 * sampai petugas lab mencobanya sendiri.
 */
const FUNGSI_WAJIB = [
  {
    nama: 'catat_pengembalian',
    // Dipanggil dengan argumen lengkap tapi id yang pasti tidak ada.
    // Fungsinya akan menolak dengan TIDAK_DITEMUKAN sebelum menyentuh
    // data apa pun — dan penolakan itu justru buktinya ia ada.
    //
    // Memanggilnya tanpa argumen TIDAK bisa dipakai: PostgREST akan
    // mencari versi berargumen nol, tidak menemukannya, lalu melapor
    // "fungsi tidak ada" meski fungsi yang sebenarnya hadir.
    argumen: {
      p_id: '00000000-0000-0000-0000-000000000000',
      p_rusak: 0,
      p_hilang: 0,
      p_admin: null,
      p_catatan: null,
    },
  },
];

/** Hanya "fungsinya tidak ada" yang dihitung kurang; galat lain berarti ada. */
function karenaFungsiHilang(error) {
  if (!error) return false;
  return error.code === '42883'
    || error.code === 'PGRST202'
    || /could not find the function/i.test(error.message || '');
}

export const PESAN_SKEMA_LAMA =
  'Database belum sesuai dengan versi aplikasi ini. Jalankan berkas di ' +
  'database/migrasi/ yang belum dijalankan, lalu database/schema.sql di ' +
  'Supabase SQL Editor.';

// Sebelum pemeriksaan pertama selesai, statusnya "belum diketahui" — bukan
// "siap". Menganggapnya siap sejak awal membuat /api/health melaporkan
// semuanya baik justru saat database sama sekali tidak terjangkau.
let hasilTerakhir = { diperiksa: false, terjangkau: null, siap: false, kurang: [] };

export const statusSkema = () => hasilTerakhir;

/** Kode 42703 = kolom tidak ada (undefined_column di PostgreSQL). */
export const karenaKolomHilang = (error) => error?.code === '42703';

export async function periksaSkema() {
  const kurang = [];

  for (const { tabel, kolom } of KOLOM_WAJIB) {
    const { error } = await supabaseAdmin.from(tabel).select(kolom).limit(1);

    if (karenaDatabaseTakTerjangkau(error)) {
      hasilTerakhir = { diperiksa: true, terjangkau: false, siap: false, kurang: [] };
      console.warn(
        '\n⚠  Supabase tidak bisa dihubungi dari komputer ini.\n' +
        '   Periksa koneksi internet. Aplikasi akan tetap menyala, tapi data\n' +
        '   tidak bisa dimuat sampai koneksinya pulih.\n'
      );
      return hasilTerakhir;
    }

    if (karenaKolomHilang(error)) kurang.push(`${tabel}.${kolom}`);
    else if (error) console.warn(`Tidak bisa memeriksa ${tabel}.${kolom}: ${error.message}`);
  }

  for (const { nama, argumen } of FUNGSI_WAJIB) {
    const { error } = await supabaseAdmin.rpc(nama, argumen);

    if (karenaDatabaseTakTerjangkau(error)) break;
    if (karenaFungsiHilang(error)) kurang.push(`fungsi ${nama}()`);
  }

  hasilTerakhir = { diperiksa: true, terjangkau: true, siap: kurang.length === 0, kurang };

  if (!hasilTerakhir.siap) {
    console.warn(
      `\n⚠  ${PESAN_SKEMA_LAMA}\n` +
      `   Yang belum ada: ${kurang.join(', ')}\n` +
      '   Sampai itu dilakukan, panel admin tidak bisa dibuka.\n'
    );
  }

  return hasilTerakhir;
}
