/**
 * Mendaftarkan satu akun guru dari terminal.
 *
 *   cd backend
 *   npm run buat-guru
 *
 * Bisa juga langsung dengan argumen:
 *
 *   node scripts/buat-guru.js "198005202007012005" "Rina Kusumawati, S.Pd." "IPA" "081234567890"
 *
 * Guru masuk memakai NIP, dan kata sandi awalnya NIP itu sendiri — tidak
 * perlu email sama sekali. Karena NIP bukan rahasia, akunnya ditandai wajib
 * berganti kata sandi saat pertama kali masuk.
 *
 * Skrip ini memakai service role key dari backend/.env, jadi jalankan hanya
 * di komputer/server sekolah — bukan di mesin bersama.
 *
 * Untuk mendaftarkan banyak guru sekaligus, pakai menu Akun Guru di panel
 * admin yang menerima berkas Excel.
 */
import readline from 'node:readline/promises';
import { stdin, stdout, exit } from 'node:process';
import dotenv from 'dotenv';

import { buatSatuGuru } from '../src/routes/guru.js';
import { nipSah, MIN_PANJANG_NIP } from '../src/lib/akunGuru.js';

dotenv.config();

async function main() {
  for (const nama of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (!process.env[nama]) {
      console.error(`✖ ${nama} belum diisi di backend/.env`);
      exit(1);
    }
  }

  const [nipArg, namaArg, mapelArg, hpArg] = process.argv.slice(2);
  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    const nip = (nipArg || (await rl.question('NIP / NUPTK          : '))).trim();
    const nama = (namaArg || (await rl.question('Nama lengkap         : '))).trim();
    const mapel = (mapelArg ?? (await rl.question('Mata pelajaran (opsional) : '))).trim();
    const noHp = (hpArg ?? (await rl.question('Nomor HP (opsional)  : '))).trim();

    if (!nama) {
      console.error('✖ Nama tidak boleh kosong.');
      exit(1);
    }
    if (!nipSah(nip)) {
      console.error(
        `✖ NIP "${nip}" tidak bisa dipakai: minimal ${MIN_PANJANG_NIP} karakter dan hanya ` +
        'boleh berisi huruf atau angka.\n' +
        '  Untuk guru tanpa NIP resmi, pakai NUPTK atau nomor yang ditetapkan sekolah.'
      );
      exit(1);
    }

    const guru = await buatSatuGuru({ nama, nip, mapel: mapel || null, no_hp: noHp || null });

    console.log('\n✔ Akun guru dibuat.');
    console.log(`  Nama        : ${guru.nama}`);
    console.log(`  NIP         : ${guru.nip}`);
    console.log('  Kata sandi  : NIP sendiri');
    console.log('\n  Beri tahu yang bersangkutan: masuk memakai NIP, lalu aplikasi');
    console.log('  akan langsung meminta mengganti kata sandinya.');
  } catch (err) {
    console.error(`\n✖ Gagal: ${err.message}`);
    exit(1);
  } finally {
    rl.close();
  }
}

main();
