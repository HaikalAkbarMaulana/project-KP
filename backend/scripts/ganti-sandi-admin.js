/**
 * Mengganti kata sandi akun admin yang sudah ada.
 *
 *   cd backend
 *   npm run ganti-sandi
 *
 * Dipakai kalau kata sandi admin lupa atau perlu diganti. Kata sandi lama
 * TIDAK bisa dibaca dari mana pun — Supabase menyimpannya sebagai hash
 * bcrypt, dan hash dirancang supaya tidak bisa dikembalikan ke teks asli.
 * Jadi satu-satunya jalan adalah menimpanya dengan yang baru.
 *
 * Bisa juga langsung dengan argumen agar sandinya tidak tampil di layar:
 *
 *   node scripts/ganti-sandi-admin.js "petugas@sekolah.sch.id" "SandiBaruRahasia"
 *
 * Skrip ini memakai service role key dari backend/.env, jadi jalankan
 * hanya di komputer/server sekolah.
 */
import readline from 'node:readline/promises';
import { stdin, stdout, exit } from 'node:process';
import dotenv from 'dotenv';

import { supabaseAdmin } from '../src/supabaseClient.js';

dotenv.config();

const PANJANG_SANDI_MIN = 8;

/** Supabase JS v2 tidak punya pencarian akun per email, jadi ditelusuri per halaman. */
async function cariAkunLewatEmail(email) {
  for (let halaman = 1; halaman <= 20; halaman += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: halaman, perPage: 200 });
    if (error) throw new Error(`Gagal membaca daftar akun: ${error.message}`);

    const ketemu = data.users.find((u) => u.email?.toLowerCase() === email);
    if (ketemu) return ketemu;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function main() {
  for (const nama of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (!process.env[nama]) {
      console.error(`✖ ${nama} belum diisi di backend/.env`);
      exit(1);
    }
  }

  const [emailArg, sandiArg] = process.argv.slice(2);
  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    const email = (emailArg || (await rl.question('Email admin : '))).trim().toLowerCase();
    const akun = await cariAkunLewatEmail(email);

    if (!akun) {
      throw new Error(
        `Tidak ada akun dengan email ${email}. Buat akun baru dengan: npm run buat-admin`
      );
    }

    const { data: profil } = await supabaseAdmin
      .from('profil').select('nama').eq('id', akun.id).maybeSingle();

    if (!profil) {
      console.warn(
        `⚠ Akun ${email} ada di Supabase Auth tapi belum terdaftar di tabel profil,\n` +
        '  sehingga belum bisa masuk ke panel admin meskipun sandinya diganti.'
      );
    } else {
      console.log(`Akun ditemukan: ${profil.nama} <${email}>`);
    }

    const sandi = sandiArg || (await rl.question(
      `Kata sandi baru (min ${PANJANG_SANDI_MIN} karakter, akan terlihat saat diketik): `
    ));

    if (sandi.length < PANJANG_SANDI_MIN) {
      throw new Error(`Kata sandi minimal ${PANJANG_SANDI_MIN} karakter.`);
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(akun.id, { password: sandi });
    if (error) throw new Error(`Gagal mengganti kata sandi: ${error.message}`);

    console.log(`\n✔ Kata sandi ${email} berhasil diganti.`);
    console.log('  Coba masuk lewat halaman /admin/masuk.');
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(`\n✖ ${err.message}`);
  exit(1);
});
