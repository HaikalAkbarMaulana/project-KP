/**
 * Membuat akun admin/petugas lab pertama.
 *
 *   cd backend
 *   npm run buat-admin
 *
 * Bisa juga langsung dengan argumen agar kata sandi tidak tampil di layar:
 *
 *   node scripts/buat-admin.js "petugas@sekolah.sch.id" "KataSandiRahasia" "Bu Rina" "Kepala Lab IPA"
 *
 * Skrip ini memakai service role key dari backend/.env, jadi jalankan hanya
 * di komputer/server sekolah — bukan di mesin bersama.
 *
 * Untuk admin berikutnya, tidak perlu skrip ini: pakai menu
 * "Akun Admin" di dalam panel admin.
 */
import readline from 'node:readline/promises';
import { stdin, stdout, exit } from 'node:process';
import dotenv from 'dotenv';

import { supabaseAdmin } from '../src/supabaseClient.js';

dotenv.config();

const PANJANG_SANDI_MIN = 8;

async function main() {
  for (const nama of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (!process.env[nama]) {
      console.error(`✖ ${nama} belum diisi di backend/.env`);
      exit(1);
    }
  }

  const [emailArg, sandiArg, namaArg, jabatanArg] = process.argv.slice(2);
  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    const email = (emailArg || (await rl.question('Email admin        : '))).trim().toLowerCase();
    const nama = (namaArg || (await rl.question('Nama lengkap       : '))).trim();
    const jabatan = (jabatanArg ?? (await rl.question('Jabatan (opsional) : '))).trim();

    const sandi = sandiArg || (await rl.question(
      `Kata sandi (min ${PANJANG_SANDI_MIN} karakter, akan terlihat saat diketik): `
    ));

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      throw new Error('Format email tidak valid.');
    }
    if (!nama) throw new Error('Nama lengkap wajib diisi.');
    if (sandi.length < PANJANG_SANDI_MIN) {
      throw new Error(`Kata sandi minimal ${PANJANG_SANDI_MIN} karakter.`);
    }

    const { data: sudahAda } = await supabaseAdmin
      .from('profil').select('id, nama').eq('email', email).maybeSingle();

    if (sudahAda) {
      console.log(`\n✔ ${email} sudah terdaftar sebagai admin (${sudahAda.nama}). Tidak ada yang diubah.`);
      return;
    }

    const { data: userBaru, error: errUser } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: sandi,
      email_confirm: true,
    });

    if (errUser) throw new Error(`Gagal membuat akun di Supabase Auth: ${errUser.message}`);

    const { error: errProfil } = await supabaseAdmin.from('profil').insert({
      id: userBaru.user.id,
      nama,
      email,
      jabatan: jabatan || null,
      aktif: true,
      // WAJIB disebut. Bawaan kolom ini 'guru' — sengaja dipilih yang paling
      // tidak berbahaya agar kelalaian tidak melahirkan admin baru. Tanpa
      // baris ini, profilnya tersimpan sebagai guru lalu ditolak aturan
      // "guru wajib punya NIP", dan akun auth-nya tertinggal tanpa profil.
      peran: 'admin',
    });

    if (errProfil) {
      // Akun auth tanpa baris profil tidak akan dikenali aplikasi, jadi
      // lebih baik dibersihkan daripada menggantung.
      //
      // Penghapusannya bisa ikut gagal (Supabase kadang menolak dengan
      // "Database error deleting user"). Kalau itu terjadi, akunnya tetap
      // tertinggal di Supabase Auth — maka sebutkan emailnya di pesan galat
      // supaya jelas apa yang harus dibereskan, bukan dibiarkan senyap.
      const { error: errHapus } = await supabaseAdmin.auth.admin
        .deleteUser(userBaru.user.id)
        .catch((e) => ({ error: e }));

      throw new Error(
        `Gagal menyimpan profil: ${errProfil.message}` +
        (errHapus
          ? `\n  Akun ${email} terlanjur dibuat di Supabase Auth dan gagal dihapus otomatis.` +
            '\n  Hapus manual lewat Supabase Dashboard -> Authentication -> Users sebelum mencoba lagi.'
          : '')
      );
    }

    console.log(`\n✔ Akun admin dibuat untuk ${nama} <${email}>`);
    console.log('  Masuk lewat halaman /admin/masuk di aplikasi.');
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(`\n✖ ${err.message}`);
  exit(1);
});
