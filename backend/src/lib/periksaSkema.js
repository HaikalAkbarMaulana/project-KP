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

export const PESAN_SKEMA_LAMA =
  'Database masih memakai skema lama. Jalankan database/migrasi/001-admin-saja.sql ' +
  'lalu database/schema.sql di Supabase SQL Editor.';

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

  hasilTerakhir = { diperiksa: true, terjangkau: true, siap: kurang.length === 0, kurang };

  if (!hasilTerakhir.siap) {
    console.warn(
      `\n⚠  ${PESAN_SKEMA_LAMA}\n` +
      `   Kolom yang belum ada: ${kurang.join(', ')}\n` +
      '   Sampai itu dilakukan, panel admin tidak bisa dibuka.\n'
    );
  }

  return hasilTerakhir;
}
