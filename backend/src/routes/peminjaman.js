import { Router } from 'express';
import { randomInt } from 'node:crypto';

import { supabaseAdmin } from '../supabaseClient.js';
import { wajibAdmin } from '../middleware/auth.js';
import { pembatasLaju } from '../middleware/pembatasLaju.js';
import { catatAktivitas } from '../lib/log.js';
import { GalatAplikasi, galatTidakDitemukan, galatValidasi, galatKonflik } from '../lib/galat.js';
import * as v from '../lib/validasi.js';

const router = Router();

export const SEMUA_STATUS = ['pending', 'disetujui', 'ditolak', 'dipinjam', 'dikembalikan', 'dibatalkan'];

// Status yang menahan stok. Harus sama dengan yang dipakai trigger
// fn_sinkron_stok() di database.
const STATUS_MENAHAN_STOK = ['disetujui', 'dipinjam'];

// Perpindahan status yang diizinkan. Tanpa aturan ini, pengajuan yang
// sudah dikembalikan masih bisa "disetujui" lagi dan stok jadi kacau.
const TRANSISI_SAH = {
  pending: ['disetujui', 'ditolak', 'dibatalkan'],
  disetujui: ['dipinjam', 'dibatalkan', 'ditolak'],
  dipinjam: ['dikembalikan'],
  ditolak: [],
  dibatalkan: [],
  dikembalikan: [],
};

const LABEL_AKSI = {
  disetujui: 'Menyetujui peminjaman',
  ditolak: 'Menolak peminjaman',
  dipinjam: 'Menandai alat diambil',
  dikembalikan: 'Mencatat pengembalian alat',
  dibatalkan: 'Membatalkan peminjaman',
};

const RELASI_ALAT = 'alat:alat_id(id, nama_alat, kode_alat, foto_url)';
const RELASI_ADMIN = 'petugas:diproses_oleh(id, nama)';

/** Kode acak yang tidak berurutan, supaya tidak mudah ditebak orang lain. */
function buatKodePeminjaman() {
  const huruf = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa I, O, 0, 1 agar tidak salah baca
  const tanggal = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  let acak = '';
  for (let i = 0; i < 6; i += 1) acak += huruf[randomInt(huruf.length)];
  return `PJM-${tanggal}-${acak}`;
}

function hariIni() {
  return new Date().toISOString().slice(0, 10);
}

// ------------------------------------------------------------
// ENDPOINT PUBLIK
// ------------------------------------------------------------

// Guru mengajukan tanpa akun, jadi endpoint ini terbuka. Batasnya
// diperketat supaya tidak gampang dibanjiri pengajuan iseng.
const batasPengajuan = pembatasLaju({
  jendelaMs: 60 * 60 * 1000,
  maks: 10,
  pesan: 'Terlalu banyak pengajuan dari perangkat ini. Coba lagi satu jam berikutnya, atau hubungi petugas lab.',
});

// POST /api/peminjaman — pengajuan peminjaman oleh guru (PUBLIK)
router.post('/', batasPengajuan, async (req, res, next) => {
  try {
    const pengajuan = {
      nama_peminjam: v.teks(req.body.nama_peminjam, 'Nama peminjam', { wajib: true, maks: 120 }),
      nip_peminjam: v.teks(req.body.nip_peminjam, 'NIP / NUPTK', { maks: 30 }),
      mapel: v.teks(req.body.mapel, 'Mata pelajaran', { maks: 80 }),
      no_hp: v.nomorHp(req.body.no_hp, 'Nomor HP', { wajib: true }),
      alat_id: v.uuid(req.body.alat_id, 'Alat', { wajib: true }),
      jumlah: v.bilangan(req.body.jumlah, 'Jumlah', { wajib: true, min: 1, maks: 1000 }),
      keperluan: v.teks(req.body.keperluan, 'Keperluan', { wajib: true, maks: 500 }),
      tanggal_pinjam: v.tanggal(req.body.tanggal_pinjam, 'Tanggal pinjam', { wajib: true }),
      tanggal_rencana_kembali: v.tanggal(req.body.tanggal_rencana_kembali, 'Rencana kembali', { wajib: true }),
    };

    if (pengajuan.tanggal_rencana_kembali < pengajuan.tanggal_pinjam) {
      throw galatValidasi('Tanggal rencana kembali tidak boleh lebih awal dari tanggal pinjam.');
    }

    // Toleransi satu hari ke belakang supaya guru yang mengisi form
    // di malam hari untuk praktikum hari itu tidak tertolak.
    const kemarin = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (pengajuan.tanggal_pinjam < kemarin) {
      throw galatValidasi('Tanggal pinjam sudah lewat. Pilih tanggal hari ini atau setelahnya.');
    }

    const { data: alat, error: errAlat } = await supabaseAdmin
      .from('alat')
      .select('id, nama_alat, jumlah_tersedia, boleh_dipinjam')
      .eq('id', pengajuan.alat_id)
      .maybeSingle();

    if (errAlat) throw errAlat;
    if (!alat) throw galatTidakDitemukan('Alat yang dipilih tidak ditemukan.');
    if (!alat.boleh_dipinjam) {
      throw galatValidasi(`"${alat.nama_alat}" tidak dipinjamkan keluar. Silakan hubungi petugas lab.`);
    }
    if (alat.jumlah_tersedia < pengajuan.jumlah) {
      throw galatValidasi(
        `Stok tidak mencukupi. Saat ini tersedia ${alat.jumlah_tersedia} unit.`
      );
    }

    // Pengecekan stok di atas hanya penyaring awal supaya pesannya ramah.
    // Stok baru benar-benar ditahan saat admin menyetujui, dan di sanalah
    // ketersediaan dipastikan lagi.
    const { data, error } = await sisipkanDenganKodeUnik(pengajuan);
    if (error) throw error;

    await catatAktivitas({
      admin: null,
      aksi: 'Pengajuan peminjaman baru',
      keterangan: `${pengajuan.nama_peminjam} mengajukan pinjam "${alat.nama_alat}" (${pengajuan.jumlah} unit)`,
    });

    res.status(201).json({
      data: { kode_peminjaman: data.kode_peminjaman, status: data.status },
      pesan: 'Pengajuan terkirim. Simpan kode di bawah ini untuk melacak statusnya.',
    });
  } catch (err) {
    next(err);
  }
});

/** Menyisipkan pengajuan, mengulang bila kode acaknya kebetulan bentrok. */
async function sisipkanDenganKodeUnik(pengajuan, sisaPercobaan = 5) {
  const { data, error } = await supabaseAdmin
    .from('peminjaman')
    .insert({ ...pengajuan, kode_peminjaman: buatKodePeminjaman(), status: 'pending' })
    .select('kode_peminjaman, status')
    .single();

  if (error?.code === '23505' && sisaPercobaan > 0) {
    return sisipkanDenganKodeUnik(pengajuan, sisaPercobaan - 1);
  }
  return { data, error };
}

// GET /api/peminjaman/lacak/:kode — guru memeriksa status pengajuannya (PUBLIK)
const batasPelacakan = pembatasLaju({
  jendelaMs: 60_000,
  maks: 20,
  pesan: 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.',
});

router.get('/lacak/:kode', batasPelacakan, async (req, res, next) => {
  try {
    const kode = v.teks(req.params.kode, 'Kode peminjaman', { wajib: true, maks: 40 }).toUpperCase();

    const { data, error } = await supabaseAdmin
      .from('peminjaman')
      .select(`
        kode_peminjaman, nama_peminjam, jumlah, keperluan,
        tanggal_pinjam, tanggal_rencana_kembali, tanggal_kembali_aktual,
        status, catatan_admin, dibuat_pada,
        ${RELASI_ALAT}
      `)
      .eq('kode_peminjaman', kode)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      throw galatTidakDitemukan('Kode peminjaman tidak ditemukan. Periksa lagi penulisannya.');
    }

    // Nama peminjam ditampilkan sebagian saja. Kode bisa saja dicoba-coba
    // orang lain, dan nomor HP tidak pernah dikirim ke endpoint publik ini.
    res.json({ data: { ...data, nama_peminjam: samarkanNama(data.nama_peminjam) } });
  } catch (err) {
    next(err);
  }
});

// POST /api/peminjaman/lacak/:kode/batal — guru membatalkan sendiri (PUBLIK)
//
// Dibatasi lebih ketat daripada pelacakan biasa. Pembuktiannya 4 digit
// terakhir nomor HP: ada 10.000 kemungkinan, dan dengan batas 10 percobaan
// per jam menebaknya tidak masuk akal. Batas ini juga yang membuat kode
// peminjaman saja tidak cukup untuk membatalkan milik orang lain.
const batasPembatalan = pembatasLaju({
  jendelaMs: 60 * 60 * 1000,
  maks: 10,
  pesan: 'Terlalu banyak percobaan pembatalan dari perangkat ini. Coba lagi satu jam berikutnya, atau hubungi petugas lab.',
});

router.post('/lacak/:kode/batal', batasPembatalan, async (req, res, next) => {
  try {
    const kode = v.teks(req.params.kode, 'Kode peminjaman', { wajib: true, maks: 40 }).toUpperCase();
    const empatDigit = v.teks(req.body.empat_digit_hp, '4 digit terakhir nomor HP', {
      wajib: true, maks: 4,
    });

    if (!/^\d{4}$/.test(empatDigit)) {
      throw galatValidasi('Masukkan tepat 4 angka terakhir nomor HP yang dipakai saat mengajukan.');
    }

    const { data: pengajuan, error: errAmbil } = await supabaseAdmin
      .from('peminjaman')
      .select('id, status, no_hp, nama_peminjam, alat:alat_id(nama_alat)')
      .eq('kode_peminjaman', kode)
      .maybeSingle();

    if (errAmbil) throw errAmbil;
    if (!pengajuan) {
      throw galatTidakDitemukan('Kode peminjaman tidak ditemukan. Periksa lagi penulisannya.');
    }

    if (pengajuan.status !== 'pending') {
      throw galatKonflik(
        `Pengajuan ini sudah berstatus "${pengajuan.status}" sehingga tidak bisa dibatalkan sendiri. ` +
        'Hubungi petugas lab bila perlu diubah.'
      );
    }

    const digitAsli = (pengajuan.no_hp || '').replace(/\D/g, '').slice(-4);
    if (digitAsli !== empatDigit) {
      throw new GalatAplikasi(
        '4 digit terakhir nomor HP tidak cocok dengan yang dipakai saat mengajukan.',
        403
      );
    }

    const { data, error } = await supabaseAdmin
      .from('peminjaman')
      .update({ status: 'dibatalkan', catatan_admin: 'Dibatalkan sendiri oleh pengaju.' })
      .eq('id', pengajuan.id)
      // Pengaman bila petugas lab kebetulan memproses di saat bersamaan.
      .eq('status', 'pending')
      .select('kode_peminjaman, status')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      throw galatKonflik('Pengajuan ini baru saja diproses petugas lab. Segarkan halaman lalu periksa lagi.');
    }

    await catatAktivitas({
      admin: { id: null, nama: `${pengajuan.nama_peminjam} (pengaju)` },
      aksi: LABEL_AKSI.dibatalkan,
      keterangan: `${pengajuan.nama_peminjam} membatalkan sendiri pengajuan "${pengajuan.alat?.nama_alat}"`,
    });

    res.json({ data, pesan: 'Pengajuan berhasil dibatalkan.' });
  } catch (err) {
    next(err);
  }
});

function samarkanNama(nama) {
  return nama
    .split(' ')
    .map((kata, i) => (i === 0 ? kata : `${kata[0]}${'*'.repeat(Math.max(kata.length - 1, 1))}`))
    .join(' ');
}

// ------------------------------------------------------------
// ENDPOINT ADMIN
// ------------------------------------------------------------

// GET /api/peminjaman — daftar seluruh pengajuan (ADMIN)
router.get('/', wajibAdmin, async (req, res, next) => {
  try {
    const halaman = v.bilangan(req.query.halaman, 'Halaman', { min: 1, maks: 10_000, bawaan: 1 });
    const perHalaman = v.bilangan(req.query.per_halaman, 'Jumlah per halaman', {
      min: 1, maks: 200, bawaan: 50,
    });
    const dari = (halaman - 1) * perHalaman;

    let query = supabaseAdmin
      .from('peminjaman')
      .select(`*, ${RELASI_ALAT}, ${RELASI_ADMIN}`, { count: 'exact' })
      .order('dibuat_pada', { ascending: false })
      .range(dari, dari + perHalaman - 1);

    const status = v.pilihan(req.query.status, 'Status', SEMUA_STATUS);
    if (status) query = query.eq('status', status);

    const pola = v.polaPencarian(req.query.q);
    if (pola) query = query.or(`nama_peminjam.ilike.${pola},kode_peminjaman.ilike.${pola}`);

    // ?terlambat=1 → masih dipinjam padahal rencana kembali sudah lewat
    if (v.boolean(req.query.terlambat, false)) {
      query = query.eq('status', 'dipinjam').lt('tanggal_rencana_kembali', hariIni());
    }

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({ data, halaman: { nomor: halaman, per_halaman: perHalaman, total: count ?? 0 } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/peminjaman/:id/status — memproses pengajuan (ADMIN)
router.patch('/:id/status', wajibAdmin, async (req, res, next) => {
  try {
    const id = v.uuid(req.params.id, 'ID peminjaman', { wajib: true });
    const status = v.pilihan(req.body.status, 'Status', SEMUA_STATUS.filter((s) => s !== 'pending'), {
      wajib: true,
    });
    const catatan = v.teks(req.body.catatan_admin, 'Catatan admin', { maks: 500 });

    const { data: sekarang, error: errAmbil } = await supabaseAdmin
      .from('peminjaman')
      .select('id, status, jumlah, alat_id, nama_peminjam, alat:alat_id(nama_alat, jumlah_tersedia)')
      .eq('id', id)
      .maybeSingle();

    if (errAmbil) throw errAmbil;
    if (!sekarang) throw galatTidakDitemukan('Data peminjaman tidak ditemukan.');

    if (sekarang.status === status) {
      throw galatKonflik(`Pengajuan ini sudah berstatus "${status}".`);
    }

    if (!TRANSISI_SAH[sekarang.status]?.includes(status)) {
      throw galatKonflik(
        `Status "${sekarang.status}" tidak bisa langsung diubah menjadi "${status}".`
      );
    }

    // Ketersediaan diperiksa saat menahan stok, bukan saat pengajuan masuk.
    // Beberapa guru bisa mengajukan alat yang sama selagi masih pending,
    // jadi tanpa pemeriksaan di sini persetujuan kedua akan ditolak mentah
    // oleh constraint database dengan pesan yang tidak dimengerti petugas.
    const akanMenahanStok =
      STATUS_MENAHAN_STOK.includes(status) && !STATUS_MENAHAN_STOK.includes(sekarang.status);

    if (akanMenahanStok && sekarang.alat.jumlah_tersedia < sekarang.jumlah) {
      throw galatKonflik(
        `Stok "${sekarang.alat.nama_alat}" tinggal ${sekarang.alat.jumlah_tersedia} unit, ` +
        `sedangkan pengajuan ini ${sekarang.jumlah} unit. Tolak pengajuan atau tunggu pengembalian.`
      );
    }

    const payload = {
      status,
      diproses_oleh: req.admin.id,
      ...(catatan !== null ? { catatan_admin: catatan } : {}),
    };
    if (status === 'dikembalikan') payload.tanggal_kembali_aktual = hariIni();

    const { data, error } = await supabaseAdmin
      .from('peminjaman')
      .update(payload)
      .eq('id', id)
      // Pastikan status belum diubah petugas lain sejak dibaca di atas.
      .eq('status', sekarang.status)
      .select(`*, ${RELASI_ALAT}, ${RELASI_ADMIN}`)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      throw galatKonflik('Data ini baru saja diubah petugas lain. Segarkan halaman lalu ulangi.');
    }

    await catatAktivitas({
      admin: req.admin,
      aksi: LABEL_AKSI[status],
      keterangan: `${LABEL_AKSI[status]} "${data.alat?.nama_alat}" atas nama ${data.nama_peminjam}`,
    });

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/peminjaman/:id — menghapus baris peminjaman (ADMIN)
//
// Dipakai membersihkan kiriman iseng, dobel, atau salah isi. Form pengajuan
// terbuka untuk umum, jadi data semacam itu pasti ada.
router.delete('/:id', wajibAdmin, async (req, res, next) => {
  try {
    const id = v.uuid(req.params.id, 'ID peminjaman', { wajib: true });

    const { data: pengajuan, error: errAmbil } = await supabaseAdmin
      .from('peminjaman')
      .select('kode_peminjaman, nama_peminjam, jumlah, status, alat:alat_id(nama_alat)')
      .eq('id', id)
      .maybeSingle();

    if (errAmbil) throw errAmbil;
    if (!pengajuan) throw galatTidakDitemukan('Data peminjaman tidak ditemukan.');

    // Menghapus baris yang sedang menahan stok akan melepas stoknya lewat
    // trigger, padahal alatnya masih berada di tangan guru. Catatan akan
    // mengatakan alat tersedia sementara kenyataannya tidak.
    if (STATUS_MENAHAN_STOK.includes(pengajuan.status)) {
      throw galatKonflik(
        `Pengajuan ini berstatus "${pengajuan.status}" dan sedang menahan ` +
        `${pengajuan.jumlah} unit "${pengajuan.alat?.nama_alat}". Catat pengembaliannya ` +
        'atau batalkan dulu, baru barisnya boleh dihapus.'
      );
    }

    const { error } = await supabaseAdmin.from('peminjaman').delete().eq('id', id);
    if (error) throw error;

    await catatAktivitas({
      admin: req.admin,
      aksi: 'Menghapus data peminjaman',
      keterangan:
        `Menghapus pengajuan ${pengajuan.kode_peminjaman} atas nama ` +
        `${pengajuan.nama_peminjam} untuk "${pengajuan.alat?.nama_alat}"`,
    });

    res.json({ pesan: `Pengajuan ${pengajuan.kode_peminjaman} berhasil dihapus.` });
  } catch (err) {
    next(err);
  }
});

export default router;
