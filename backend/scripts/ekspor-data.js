/**
 * Mengekspor seluruh isi database menjadi satu berkas SQL siap jalan.
 *
 *   cd backend
 *   npm run ekspor-data
 *
 * Gunanya dua: cadangan berkala, dan bekal saat memindahkan proyek ke akun
 * Supabase lain. Berkasnya ditulis ke folder backup/ di akar proyek, yang
 * sudah dikecualikan dari git karena memuat nama dan nomor HP.
 *
 * Yang TIDAK ikut terekspor:
 *  - akun admin beserta kata sandinya, karena tersimpan sebagai hash di
 *    sistem Auth Supabase dan tidak bisa dipindahkan; buat ulang dengan
 *    npm run buat-admin
 *  - berkas foto alat; unduh terpisah dengan npm run ekspor-foto
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import { supabaseAdmin } from '../src/supabaseClient.js';

dotenv.config();

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Mengubah satu nilai JavaScript menjadi penulisan nilai SQL. */
function nilaiSql(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function perintahSisip(tabel, kolom, baris) {
  const nilai = kolom.map((k) => nilaiSql(baris[k])).join(', ');
  return `insert into public.${tabel} (${kolom.join(', ')}) values (${nilai}) on conflict (id) do nothing;`;
}

// Urutannya penting: tabel yang dirujuk harus terisi lebih dulu.
const URUTAN = [
  {
    tabel: 'ruangan',
    kolom: ['id', 'nama_ruangan', 'keterangan', 'penanggung_jawab', 'dibuat_pada'],
  },
  {
    tabel: 'kategori',
    kolom: ['id', 'nama_kategori', 'dibuat_pada'],
  },
  {
    tabel: 'alat',
    // jumlah_dipinjam sengaja dilewati: nilainya dijaga trigger dan akan
    // terbentuk sendiri saat data peminjaman disisipkan. jumlah_total dan
    // jumlah_tersedia kolom terhitung, tidak bisa ditulis.
    kolom: [
      'id', 'kode_alat', 'nama_alat', 'kategori_id', 'ruangan_id',
      'jumlah_baik', 'jumlah_rusak', 'merk_tipe', 'nomor_seri', 'tahun_perolehan',
      'sumber_dana', 'harga_satuan', 'boleh_dipinjam', 'foto_url', 'deskripsi', 'dibuat_pada',
    ],
  },
  {
    tabel: 'peminjaman',
    // diproses_oleh dilewati: menunjuk akun admin yang tidak ikut pindah.
    kolom: [
      'id', 'kode_peminjaman', 'nama_peminjam', 'nip_peminjam', 'mapel', 'no_hp',
      'alat_id', 'jumlah', 'keperluan', 'tanggal_pinjam', 'tanggal_rencana_kembali',
      'tanggal_kembali_aktual', 'jumlah_kembali_rusak', 'jumlah_hilang',
      'status', 'catatan_admin', 'dibuat_pada',
    ],
  },
  {
    tabel: 'log_aktivitas',
    kolom: ['id', 'aktor_nama', 'aksi', 'keterangan', 'dibuat_pada'],
  },
];

async function main() {
  const bagian = [];
  const ringkasan = [];

  for (const { tabel, kolom } of URUTAN) {
    const { data, error } = await supabaseAdmin.from(tabel).select(kolom.join(',')).limit(10000);
    if (error) throw new Error(`Gagal membaca ${tabel}: ${error.message}`);

    ringkasan.push(`${data.length} ${tabel}`);
    bagian.push(
      `-- ${tabel} (${data.length} baris)`,
      ...data.map((b) => perintahSisip(tabel, kolom, b)),
      ''
    );
  }

  const waktu = new Date();
  const stempel = waktu.toLocaleDateString('sv-SE');

  const isi = [
    '-- Cadangan data LabPinjam - SMP Negeri 3 Kedungreja',
    `-- Dibuat: ${waktu.toLocaleString('id-ID')}`,
    '--',
    '-- Cara memakai di proyek Supabase baru:',
    '--   1. Jalankan database/schema.sql lebih dulu untuk membuat tabelnya',
    '--   2. Tempel seluruh isi berkas ini di SQL Editor lalu jalankan',
    '--   3. Samakan hitungan stok:  select public.hitung_ulang_stok();',
    '--   4. Buat ulang akun admin:  cd backend && npm run buat-admin',
    '--   5. Unggah ulang foto alat (lihat folder backup/foto-alat)',
    '--',
    '-- Perintahnya memakai "on conflict do nothing", jadi aman dijalankan',
    '-- berulang tanpa menggandakan data.',
    '',
    ...bagian,
    '-- Setelah ini, samakan hitungan stok:',
    'select public.hitung_ulang_stok();',
    '',
  ].join('\n');

  const folder = path.join(AKAR, 'backup');
  fs.mkdirSync(folder, { recursive: true });

  const berkas = path.join(folder, `data-${stempel}.sql`);
  fs.writeFileSync(berkas, isi, 'utf8');

  console.log(`✔ Tersimpan: ${path.relative(AKAR, berkas)}`);
  console.log(`  Isi: ${ringkasan.join(', ')}`);
}

main().catch((err) => {
  console.error(`✖ ${err.message}`);
  process.exit(1);
});
