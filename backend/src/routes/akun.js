import { Router } from 'express';

import { supabaseAdmin } from '../supabaseClient.js';
import { wajibMasuk } from '../middleware/auth.js';
import { pembatasLaju } from '../middleware/pembatasLaju.js';
import { catatAktivitas } from '../lib/log.js';
import { galatValidasi } from '../lib/galat.js';
import * as v from '../lib/validasi.js';

const router = Router();

/** Panjang minimum kata sandi. Supabase sendiri hanya mensyaratkan 6. */
const MIN_SANDI = 8;

// GET /api/akun/saya — identitas pemakai sesi ini, apa pun perannya.
//
// Frontend memanggil ini tepat setelah masuk untuk tahu harus dibawa ke
// panel admin atau ke halaman guru, dan apakah kata sandinya wajib diganti
// lebih dulu.
router.get('/saya', wajibMasuk, (req, res) => {
  const { id, nama, email, jabatan, no_hp, peran, nip, mapel, harus_ganti_sandi } = req.pengguna;
  res.json({
    data: { id, nama, email, jabatan, no_hp, peran, nip, mapel, harus_ganti_sandi },
  });
});

// Percobaan ganti sandi dibatasi supaya kata sandi lama tidak bisa ditebak
// dengan mencoba berkali-kali lewat endpoint ini.
const batasGantiSandi = pembatasLaju({
  jendelaMs: 15 * 60 * 1000,
  maks: 10,
  pesan: 'Terlalu banyak percobaan ganti kata sandi. Tunggu beberapa menit lalu coba lagi.',
});

// POST /api/akun/ganti-sandi — mengganti kata sandi sendiri.
router.post('/ganti-sandi', batasGantiSandi, wajibMasuk, async (req, res, next) => {
  try {
    const pengguna = req.pengguna;
    const sandiBaru = v.teks(req.body.sandi_baru, 'Kata sandi baru', { wajib: true, maks: 72 });

    if (sandiBaru.length < MIN_SANDI) {
      throw galatValidasi(`Kata sandi baru minimal ${MIN_SANDI} karakter.`);
    }

    // Inti dari kewajiban ganti sandi: kata sandi awal guru adalah NIP-nya,
    // dan NIP itu tertulis di dokumen kepegawaian serta ikut tampil di
    // daftar peminjaman. Mengizinkan NIP dipakai lagi sebagai kata sandi
    // "baru" akan membatalkan seluruh gunanya.
    if (pengguna.nip && sandiBaru === pengguna.nip) {
      throw galatValidasi('Kata sandi baru tidak boleh sama dengan NIP Anda. Pilih kata sandi lain.');
    }

    // Saat kata sandi awal masih dipakai, kata sandi lama tidak diminta:
    // pengguna baru saja membuktikannya dengan berhasil masuk, dan
    // memintanya lagi hanya menambah kebingungan di layar pertama.
    if (!pengguna.harus_ganti_sandi) {
      const sandiLama = v.teks(req.body.sandi_lama, 'Kata sandi lama', { wajib: true, maks: 72 });

      const { error: errCocok } = await supabaseAdmin.auth.signInWithPassword({
        email: pengguna.email,
        password: sandiLama,
      });
      if (errCocok) throw galatValidasi('Kata sandi lama salah.');

      if (sandiLama === sandiBaru) {
        throw galatValidasi('Kata sandi baru harus berbeda dari yang lama.');
      }
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(pengguna.id, {
      password: sandiBaru,
    });
    if (error) throw error;

    const { error: errProfil } = await supabaseAdmin
      .from('profil')
      .update({ harus_ganti_sandi: false })
      .eq('id', pengguna.id);
    if (errProfil) throw errProfil;

    await catatAktivitas({
      admin: pengguna.peran === 'admin' ? pengguna : null,
      aksi: 'Ganti kata sandi',
      keterangan: `${pengguna.nama} mengganti kata sandinya sendiri`,
    });

    res.json({ pesan: 'Kata sandi berhasil diganti.' });
  } catch (err) {
    next(err);
  }
});

export default router;
