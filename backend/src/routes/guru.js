import { Router } from 'express';

import { supabaseAdmin } from '../supabaseClient.js';
import { wajibAdmin } from '../middleware/auth.js';
import { catatAktivitas } from '../lib/log.js';
import { galatTidakDitemukan, galatValidasi, galatKonflik } from '../lib/galat.js';
import { emailDariNip, nipSah, MIN_PANJANG_NIP } from '../lib/akunGuru.js';
import * as v from '../lib/validasi.js';

const router = Router();

const KOLOM = 'id, nama, nip, mapel, no_hp, aktif, harus_ganti_sandi, dibuat_pada';

/** Membaca dan memvalidasi satu baris data guru. */
function bacaIsianGuru(body) {
  const nama = v.teks(body.nama, 'Nama guru', { wajib: true, maks: 120 });
  const nip = v.teks(body.nip, 'NIP / NUPTK', { wajib: true, maks: 30 });

  if (!nipSah(nip)) {
    throw galatValidasi(
      `NIP "${nip}" tidak bisa dipakai: minimal ${MIN_PANJANG_NIP} karakter dan hanya boleh ` +
      'berisi huruf atau angka. Untuk guru tanpa NIP resmi, pakai NUPTK atau nomor yang ' +
      'ditetapkan sekolah.'
    );
  }

  return {
    nama,
    nip,
    mapel: v.teks(body.mapel, 'Mata pelajaran', { maks: 80 }),
    no_hp: v.nomorHp(body.no_hp, 'Nomor HP'),
  };
}

/**
 * Membuat akun guru: pengguna di Supabase Auth + baris di tabel profil.
 *
 * Kata sandi awalnya NIP itu sendiri supaya petugas lab bisa membagikannya
 * tanpa email — guru cukup diberi tahu "sandi awal Anda adalah NIP sendiri".
 * Karena NIP bukan rahasia, harus_ganti_sandi disetel true sehingga akunnya
 * tidak bisa dipakai untuk apa pun sampai sandinya diganti.
 *
 * Dipakai pendaftaran satu per satu maupun impor Excel.
 */
export async function buatSatuGuru(isian) {
  const email = emailDariNip(isian.nip);

  const { data: adaNip, error: errCek } = await supabaseAdmin
    .from('profil').select('id').eq('nip', isian.nip).maybeSingle();
  if (errCek) throw errCek;
  if (adaNip) throw galatKonflik(`NIP ${isian.nip} sudah terdaftar.`);

  const { data: userBaru, error: errUser } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: isian.nip,
    email_confirm: true, // alamatnya semu, jadi tidak ada yang bisa diverifikasi
  });

  if (errUser) {
    const sudahAda = /already|registered|exists/i.test(errUser.message || '');
    throw sudahAda
      ? galatKonflik(`NIP ${isian.nip} sudah punya akun. Hapus akun lamanya dulu.`)
      : galatValidasi(`Gagal membuat akun untuk ${isian.nama}: ${errUser.message}`);
  }

  const { data, error } = await supabaseAdmin
    .from('profil')
    .insert({
      id: userBaru.user.id,
      nama: isian.nama,
      email,
      nip: isian.nip,
      mapel: isian.mapel,
      no_hp: isian.no_hp,
      peran: 'guru',
      aktif: true,
      harus_ganti_sandi: true,
    })
    .select(KOLOM)
    .single();

  if (error) {
    // Jangan tinggalkan akun auth tanpa profil — akun seperti itu ada di
    // Supabase tapi tidak dikenali aplikasi, dan NIP-nya ikut terkunci.
    await supabaseAdmin.auth.admin.deleteUser(userBaru.user.id).catch(() => {});
    throw error;
  }

  return data;
}

// GET /api/admin/guru — daftar akun guru
router.get('/', wajibAdmin, async (req, res, next) => {
  try {
    let query = supabaseAdmin.from('profil').select(KOLOM).eq('peran', 'guru').order('nama');

    const pola = v.polaPencarian(req.query.q);
    if (pola) query = query.or(`nama.ilike.${pola},nip.ilike.${pola},mapel.ilike.${pola}`);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/guru — mendaftarkan satu guru
router.post('/', wajibAdmin, async (req, res, next) => {
  try {
    const isian = bacaIsianGuru(req.body);
    const data = await buatSatuGuru(isian);

    await catatAktivitas({
      admin: req.admin,
      aksi: 'Menambah akun guru',
      keterangan: `Mendaftarkan ${isian.nama} (NIP ${isian.nip})`,
    });

    res.status(201).json({
      data,
      pesan: `Akun ${isian.nama} dibuat. Kata sandi awalnya NIP sendiri, dan wajib diganti saat pertama masuk.`,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/guru/:id — ubah data atau aktif/nonaktifkan
router.patch('/:id', wajibAdmin, async (req, res, next) => {
  try {
    const id = v.uuid(req.params.id, 'ID guru', { wajib: true });

    const payload = v.tanpaUndefined({
      nama: v.teks(req.body.nama, 'Nama guru', { maks: 120 }) ?? undefined,
      mapel: v.teks(req.body.mapel, 'Mata pelajaran', { maks: 80 }) ?? undefined,
      no_hp: v.nomorHp(req.body.no_hp) ?? undefined,
      aktif: v.boolean(req.body.aktif),
    });

    if (Object.keys(payload).length === 0) throw galatValidasi('Tidak ada data yang diubah.');

    // NIP sengaja tidak bisa diubah: ia sekaligus nama pengguna dan dasar
    // alamat internal di Supabase Auth. Menggantinya akan memutus akun dari
    // identitasnya. Kalau NIP salah ketik, hapus lalu daftarkan ulang.
    const { data, error } = await supabaseAdmin
      .from('profil')
      .update(payload)
      .eq('id', id)
      .eq('peran', 'guru')
      .select(KOLOM)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw galatTidakDitemukan('Akun guru tidak ditemukan.');

    if (payload.aktif !== undefined) {
      await catatAktivitas({
        admin: req.admin,
        aksi: payload.aktif ? 'Mengaktifkan akun guru' : 'Menonaktifkan akun guru',
        keterangan: `${payload.aktif ? 'Mengaktifkan' : 'Menonaktifkan'} akun ${data.nama}`,
      });
    }

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/guru/:id/reset-sandi — kembalikan kata sandi ke NIP
//
// Ini jalan keluar resmi untuk guru yang lupa sandi. Tidak ada pemulihan
// lewat email karena alamat guru memang semu.
router.post('/:id/reset-sandi', wajibAdmin, async (req, res, next) => {
  try {
    const id = v.uuid(req.params.id, 'ID guru', { wajib: true });

    const { data: guru, error: errAmbil } = await supabaseAdmin
      .from('profil').select('id, nama, nip').eq('id', id).eq('peran', 'guru').maybeSingle();

    if (errAmbil) throw errAmbil;
    if (!guru) throw galatTidakDitemukan('Akun guru tidak ditemukan.');

    const { error: errSandi } = await supabaseAdmin.auth.admin.updateUserById(id, {
      password: guru.nip,
    });
    if (errSandi) throw errSandi;

    // Wajib diganti lagi: sandinya kembali menjadi NIP yang bukan rahasia.
    const { error } = await supabaseAdmin
      .from('profil').update({ harus_ganti_sandi: true }).eq('id', id);
    if (error) throw error;

    await catatAktivitas({
      admin: req.admin,
      aksi: 'Reset kata sandi guru',
      keterangan: `Mengembalikan kata sandi ${guru.nama} ke NIP`,
    });

    res.json({
      pesan: `Kata sandi ${guru.nama} dikembalikan ke NIP. Beri tahu yang bersangkutan untuk masuk lalu menggantinya.`,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/guru/:id — hapus akun guru
//
// Riwayat peminjamannya tetap ada: kolom guru_id memakai "on delete set
// null", dan identitas peminjam sudah tersalin di baris peminjaman.
router.delete('/:id', wajibAdmin, async (req, res, next) => {
  try {
    const id = v.uuid(req.params.id, 'ID guru', { wajib: true });

    const { data: guru, error: errAmbil } = await supabaseAdmin
      .from('profil').select('nama, nip').eq('id', id).eq('peran', 'guru').maybeSingle();

    if (errAmbil) throw errAmbil;
    if (!guru) throw galatTidakDitemukan('Akun guru tidak ditemukan.');

    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) throw galatValidasi(`Gagal menghapus akun: ${error.message}`);

    await catatAktivitas({
      admin: req.admin,
      aksi: 'Menghapus akun guru',
      keterangan: `Menghapus akun ${guru.nama} (NIP ${guru.nip}). Riwayat peminjamannya tetap tersimpan.`,
    });

    res.json({ pesan: `Akun ${guru.nama} dihapus. Riwayat peminjamannya tetap tersimpan.` });
  } catch (err) {
    next(err);
  }
});

export default router;
