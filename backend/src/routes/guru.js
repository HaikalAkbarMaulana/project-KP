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

  // Dicocokkan tanpa membedakan huruf besar/kecil karena emailDariNip()
  // menurunkan NIP ke huruf kecil. Tanpa ini, "UjiBB001" dan "ujibb001"
  // lolos pemeriksaan ini sebagai dua NIP berbeda, lalu Supabase Auth
  // menolaknya di langkah berikutnya -- dan pesannya menyebut NIP yang
  // tidak akan ditemukan admin di daftar, karena yang tersimpan versi
  // huruf besar.
  const { data: adaNip, error: errCek } = await supabaseAdmin
    .from('profil').select('id, nama, nip').ilike('nip', isian.nip).maybeSingle();
  if (errCek) throw errCek;
  if (adaNip) {
    throw galatKonflik(
      adaNip.nip === isian.nip
        ? `NIP ${isian.nip} sudah terdaftar.`
        : `NIP ${isian.nip} bentrok dengan "${adaNip.nip}" milik ${adaNip.nama}. ` +
          'Huruf besar dan kecil dianggap sama, jadi NIP itu harus dibedakan isinya.'
    );
  }

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

/**
 * Batas baris sekali unggah.
 *
 * Akun dibuat satu per satu lewat Supabase Auth — tidak ada cara massal —
 * dan tiap akun memakan ratusan milidetik. Batas ini menjaga satu
 * permintaan tidak berjalan begitu lama sampai ditutup paksa di tengah
 * jalan, yang akan meninggalkan sebagian akun terbuat tanpa laporan.
 */
export const MAKS_BARIS_IMPOR = 150;

/**
 * Mendaftarkan banyak guru sekaligus, melaporkan nasib tiap baris.
 *
 * Dipisahkan dari rutenya supaya bisa diuji tanpa perlu sesi admin, dan
 * supaya rute impor tinggal menerjemahkan hasilnya menjadi balasan HTTP.
 */
export async function imporBanyakGuru(baris) {
  if (!Array.isArray(baris) || baris.length === 0) {
    throw galatValidasi('Tidak ada baris yang bisa dibaca dari berkas.');
  }
  if (baris.length > MAKS_BARIS_IMPOR) {
    throw galatValidasi(
      `Sekali unggah maksimal ${MAKS_BARIS_IMPOR} baris. Berkas ini berisi ${baris.length} baris — ` +
      'bagi dua lalu unggah bergantian.'
    );
  }

  // NIP yang sudah ada diambil sekali di awal, bukan ditanyakan per baris,
  // supaya 150 baris tidak berarti 150 perjalanan tambahan ke database.
  const { data: terdaftar, error: errAmbil } = await supabaseAdmin
    .from('profil').select('nip').not('nip', 'is', null);
  if (errAmbil) throw errAmbil;

  // Dikumpulkan dalam huruf kecil, sejalan dengan pemeriksaan di
  // buatSatuGuru(): NIP yang hanya berbeda huruf besar/kecil menghasilkan
  // alamat Supabase Auth yang sama, jadi harus dianggap NIP yang sama.
  const kunciNip = (nip) => String(nip).toLowerCase();
  const sudahAda = new Set((terdaftar ?? []).map((p) => kunciNip(p.nip)));
  const adaDiBerkas = new Set();
  const hasil = [];
  let dibuat = 0;
  let dilewati = 0;
  let gagal = 0;

  for (const [i, mentah] of baris.entries()) {
    // Nomor baris mengikuti tampilan Excel: baris 1 adalah judul kolom,
    // jadi data pertama ada di baris 2. Tanpa penyesuaian ini, petugas
    // yang disuruh membetulkan "baris 7" akan membuka baris yang salah.
    const nomor = i + 2;
    const nama = String(mentah?.nama ?? '').trim();
    const nip = String(mentah?.nip ?? '').trim();

    try {
      const isian = bacaIsianGuru({
        nama,
        nip,
        mapel: mentah?.mapel ?? null,
        no_hp: mentah?.no_hp ?? null,
      });

      if (sudahAda.has(kunciNip(isian.nip))) {
        dilewati += 1;
        hasil.push({ nomor, nama, nip, status: 'dilewati', pesan: 'NIP sudah terdaftar.' });
        continue;
      }
      if (adaDiBerkas.has(kunciNip(isian.nip))) {
        gagal += 1;
        hasil.push({ nomor, nama, nip, status: 'gagal', pesan: 'NIP ganda di dalam berkas ini.' });
        continue;
      }

      await buatSatuGuru(isian);
      adaDiBerkas.add(kunciNip(isian.nip));
      dibuat += 1;
      hasil.push({ nomor, nama, nip, status: 'berhasil', pesan: '' });
    } catch (err) {
      // Satu baris bermasalah tidak membatalkan sisanya. Akun dibuat lewat
      // Supabase Auth, jadi tidak ada transaksi yang bisa memutar balik
      // baris-baris sebelumnya — berpura-pura semuanya batal justru akan
      // menyesatkan. Yang jujur adalah melaporkan nasib tiap baris.
      gagal += 1;
      hasil.push({ nomor, nama, nip, status: 'gagal', pesan: err.message });
    }
  }

  return { ringkasan: { terbaca: baris.length, dibuat, dilewati, gagal }, baris: hasil };
}

// POST /api/admin/guru/impor — mendaftarkan banyak guru sekaligus
//
// Berkas Excel-nya dibaca di browser, lalu dikirim ke sini sebagai baris
// JSON. Dengan begitu backend tidak perlu menangani unggahan berkas, dan
// yang sampai ke sini sudah berbentuk data biasa — tetap divalidasi ulang
// satu per satu, karena apa pun yang datang dari browser tidak dipercaya.
router.post('/impor', wajibAdmin, async (req, res, next) => {
  try {
    const data = await imporBanyakGuru(req.body?.baris);
    const { dibuat, dilewati, gagal } = data.ringkasan;

    if (dibuat > 0) {
      await catatAktivitas({
        admin: req.admin,
        aksi: 'Impor akun guru',
        keterangan: `Mengimpor ${dibuat} akun guru dari berkas Excel (${dilewati} dilewati, ${gagal} gagal)`,
      });
    }

    res.json({
      data,
      pesan:
        gagal === 0 && dilewati === 0
          ? `${dibuat} akun guru berhasil dibuat.`
          : `${dibuat} akun dibuat, ${dilewati} dilewati, ${gagal} gagal. Periksa rinciannya di bawah.`,
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
