import { Router } from 'express';
import { supabaseAdmin } from '../supabaseClient.js';
import { wajibAdmin } from '../middleware/auth.js';
import { catatAktivitas } from '../lib/log.js';
import { galatTidakDitemukan, galatValidasi, galatKonflik } from '../lib/galat.js';
import * as v from '../lib/validasi.js';

const router = Router();

const PANJANG_SANDI_MIN = 8;

/**
 * GET /api/admin/saya — identitas admin yang sedang masuk.
 *
 * Frontend memakai endpoint ini, bukan menanyakan tabel profil langsung ke
 * Supabase dari browser. Selain lebih sederhana, ini juga satu-satunya
 * sumber kebenaran soal "siapa yang boleh masuk panel admin".
 */
router.get('/saya', wajibAdmin, (req, res) => {
  res.json({ data: req.admin });
});

// GET /api/admin/pengguna — daftar akun pengelola
router.get('/pengguna', wajibAdmin, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('profil')
      .select('id, nama, email, no_hp, jabatan, aktif, dibuat_pada')
      .order('nama');

    if (error) throw error;
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/pengguna — mendaftarkan petugas lab baru
router.post('/pengguna', wajibAdmin, async (req, res, next) => {
  try {
    const nama = v.teks(req.body.nama, 'Nama', { wajib: true, maks: 120 });
    const email = v.email(req.body.email);
    const jabatan = v.teks(req.body.jabatan, 'Jabatan', { maks: 100 });
    const noHp = v.nomorHp(req.body.no_hp);
    const sandi = v.teks(req.body.password, 'Kata sandi', { wajib: true, maks: 72 });

    if (sandi.length < PANJANG_SANDI_MIN) {
      throw galatValidasi(`Kata sandi minimal ${PANJANG_SANDI_MIN} karakter.`);
    }

    const { data: adaProfil, error: errCek } = await supabaseAdmin
      .from('profil').select('id').eq('email', email).maybeSingle();
    if (errCek) throw errCek;
    if (adaProfil) throw galatKonflik(`Email ${email} sudah terdaftar sebagai admin.`);

    const { data: userBaru, error: errUser } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: sandi,
      email_confirm: true, // sekolah umumnya belum menyiapkan SMTP untuk verifikasi
    });

    if (errUser) {
      const sudahAda = /already|registered|exists/i.test(errUser.message || '');
      throw sudahAda
        ? galatKonflik(
            `Email ${email} sudah punya akun di Supabase Auth. Tambahkan lewat SQL Editor ` +
            'atau pakai email lain.'
          )
        : galatValidasi(`Gagal membuat akun: ${errUser.message}`);
    }

    const { data, error } = await supabaseAdmin
      .from('profil')
      .insert({ id: userBaru.user.id, nama, email, jabatan, no_hp: noHp, aktif: true })
      .select('id, nama, email, no_hp, jabatan, aktif, dibuat_pada')
      .single();

    if (error) {
      // Jangan tinggalkan akun auth tanpa profil — akun seperti itu bisa
      // masuk ke Supabase tapi tidak dikenali aplikasi.
      await supabaseAdmin.auth.admin.deleteUser(userBaru.user.id).catch(() => {});
      throw error;
    }

    await catatAktivitas({
      admin: req.admin,
      aksi: 'Menambah admin',
      keterangan: `Mendaftarkan ${nama} (${email}) sebagai petugas lab`,
    });

    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/pengguna/:id — ubah data atau aktif/nonaktifkan
router.patch('/pengguna/:id', wajibAdmin, async (req, res, next) => {
  try {
    const id = v.uuid(req.params.id, 'ID admin', { wajib: true });

    const payload = v.tanpaUndefined({
      nama: v.teks(req.body.nama, 'Nama', { maks: 120 }) ?? undefined,
      jabatan: v.teks(req.body.jabatan, 'Jabatan', { maks: 100 }) ?? undefined,
      no_hp: v.nomorHp(req.body.no_hp) ?? undefined,
      aktif: v.boolean(req.body.aktif),
    });

    if (Object.keys(payload).length === 0) throw galatValidasi('Tidak ada data yang diubah.');

    // Menonaktifkan akun sendiri akan langsung mengunci diri di luar panel.
    if (payload.aktif === false && id === req.admin.id) {
      throw galatValidasi('Anda tidak bisa menonaktifkan akun sendiri.');
    }

    if (payload.aktif === false) await pastikanBukanAdminAktifTerakhir(id);

    const { data, error } = await supabaseAdmin
      .from('profil')
      .update(payload)
      .eq('id', id)
      .select('id, nama, email, no_hp, jabatan, aktif, dibuat_pada')
      .maybeSingle();

    if (error) throw error;
    if (!data) throw galatTidakDitemukan('Akun admin tidak ditemukan.');

    if (payload.aktif !== undefined) {
      await catatAktivitas({
        admin: req.admin,
        aksi: payload.aktif ? 'Mengaktifkan admin' : 'Menonaktifkan admin',
        keterangan: `${payload.aktif ? 'Mengaktifkan' : 'Menonaktifkan'} akun ${data.nama}`,
      });
    }

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/pengguna/:id — hapus akun pengelola
router.delete('/pengguna/:id', wajibAdmin, async (req, res, next) => {
  try {
    const id = v.uuid(req.params.id, 'ID admin', { wajib: true });

    if (id === req.admin.id) throw galatValidasi('Anda tidak bisa menghapus akun sendiri.');
    await pastikanBukanAdminAktifTerakhir(id);

    const { data: target, error: errAmbil } = await supabaseAdmin
      .from('profil').select('nama, email').eq('id', id).maybeSingle();

    if (errAmbil) throw errAmbil;
    if (!target) throw galatTidakDitemukan('Akun admin tidak ditemukan.');

    // Baris profil ikut terhapus lewat "on delete cascade" dari auth.users.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) throw galatValidasi(`Gagal menghapus akun: ${error.message}`);

    await catatAktivitas({
      admin: req.admin,
      aksi: 'Menghapus admin',
      keterangan: `Menghapus akun ${target.nama} (${target.email})`,
    });

    res.json({ pesan: `Akun ${target.nama} berhasil dihapus.` });
  } catch (err) {
    next(err);
  }
});

/** Menjaga agar sistem tidak pernah kehabisan admin yang bisa masuk. */
async function pastikanBukanAdminAktifTerakhir(id) {
  const { count, error } = await supabaseAdmin
    .from('profil')
    .select('id', { count: 'exact', head: true })
    .eq('aktif', true)
    .neq('id', id);

  if (error) throw error;
  if ((count ?? 0) === 0) {
    throw galatKonflik(
      'Ini satu-satunya admin aktif. Daftarkan admin lain dulu sebelum menonaktifkan atau menghapus akun ini.'
    );
  }
}

export default router;
