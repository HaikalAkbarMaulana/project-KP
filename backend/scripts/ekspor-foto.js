/**
 * Mengunduh seluruh foto alat dari Supabase Storage.
 *
 *   cd backend
 *   npm run ekspor-foto
 *
 * Pendamping ekspor-data.js: berkas SQL menyimpan alamat fotonya, tapi
 * berkas gambarnya sendiri ada di penyimpanan Supabase dan ikut hilang bila
 * proyeknya dipindahkan atau dihapus.
 *
 * Saat memulihkan ke proyek baru, unggah ulang isi folder ini ke bucket
 * foto-alat dengan nama berkas yang sama persis — dengan begitu alamat foto
 * yang tersimpan di tabel alat hanya perlu diganti bagian nama proyeknya.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import { supabaseAdmin } from '../src/supabaseClient.js';
import { BUCKET_FOTO } from '../src/lib/penyimpanan.js';

dotenv.config();

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function main() {
  const { data: daftar, error } = await supabaseAdmin.storage.from(BUCKET_FOTO).list('', {
    limit: 1000,
  });
  if (error) throw new Error(`Gagal membaca daftar foto: ${error.message}`);

  const berkas = (daftar ?? []).filter((f) => f.id);
  if (berkas.length === 0) {
    console.log('Tidak ada foto alat untuk diunduh.');
    return;
  }

  const folder = path.join(AKAR, 'backup', 'foto-alat');
  fs.mkdirSync(folder, { recursive: true });

  let berhasil = 0;
  for (const f of berkas) {
    const { data, error: errUnduh } = await supabaseAdmin.storage.from(BUCKET_FOTO).download(f.name);
    if (errUnduh) {
      console.warn(`  ✖ ${f.name}: ${errUnduh.message}`);
      continue;
    }

    const isi = Buffer.from(await data.arrayBuffer());
    fs.writeFileSync(path.join(folder, f.name), isi);
    console.log(`  ✔ ${f.name} (${(isi.length / 1024).toFixed(0)} KB)`);
    berhasil += 1;
  }

  console.log(`\n${berhasil} dari ${berkas.length} foto tersimpan di backup/foto-alat`);
}

main().catch((err) => {
  console.error(`✖ ${err.message}`);
  process.exit(1);
});
