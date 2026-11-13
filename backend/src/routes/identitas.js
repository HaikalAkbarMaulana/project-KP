import { Router } from 'express';
import { supabaseAdmin } from '../supabaseClient.js';
import { wajibAdmin } from '../middleware/auth.js';
import { catatAktivitas } from '../lib/log.js';
import * as v from '../lib/validasi.js';

const router = Router();

/**
 * Identitas sekolah untuk kop surat laporan.
 *
 * Tabelnya hanya berisi satu baris untuk seluruh sekolah, dikunci lewat
 * kolom "tunggal" yang menjadi primary key dan hanya boleh bernilai true.
 * Karena itu tidak ada endpoint tambah maupun hapus: yang ada hanya baca
 * dan ubah.
 */

/** Kolom yang boleh ditulis klien, beserta label untuk pesan galatnya. */
const KOLOM = [
  ['pemerintah', 'Nama pemerintah daerah', 120],
  ['dinas', 'Nama dinas', 120],
  ['nama_sekolah', 'Nama sekolah', 120],
  ['alamat', 'Alamat', 200],
  ['telepon', 'Telepon', 120],
  ['laman', 'Laman', 120],
  ['posel', 'Pos-el', 120],
  ['kota', 'Kota penandatanganan', 60],
];

// GET /api/identitas — dipakai kop surat laporan (PUBLIK)
//
// Dibiarkan terbuka karena isinya memang tampil di halaman publik: nama
// sekolah sudah tertulis di bilah atas dan catatan kaki situs.
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('identitas_sekolah').select('*').maybeSingle();
    if (error) throw error;

    // Barisnya dibuat schema.sql dan migrasi, tetapi kalau karena satu dan
    // lain hal belum ada, lebih baik menjawab objek kosong daripada null —
    // halaman laporan tinggal memakai nilai bawaannya sendiri.
    res.json({ data: data ?? {} });
  } catch (err) { next(err); }
});

// PUT /api/identitas — mengubah isi kop surat (ADMIN)
router.put('/', wajibAdmin, async (req, res, next) => {
  try {
    const payload = {};
    for (const [kolom, label, maks] of KOLOM) {
      if (req.body[kolom] === undefined) continue;
      payload[kolom] = v.teks(req.body[kolom], label, { maks }) ?? '';
    }

    if (Object.keys(payload).length === 0) {
      return res.json({ data: null, pesan: 'Tidak ada data yang diubah.' });
    }
    payload.diperbarui_pada = new Date().toISOString();

    // upsert, bukan update: kalau barisnya belum ada, sekalian dibuat.
    const { data, error } = await supabaseAdmin
      .from('identitas_sekolah')
      .upsert({ tunggal: true, ...payload }, { onConflict: 'tunggal' })
      .select()
      .single();
    if (error) throw error;

    await catatAktivitas({
      admin: req.admin,
      aksi: 'Mengubah identitas sekolah',
      keterangan: `Memperbarui kop surat laporan (${Object.keys(payload)
        .filter((k) => k !== 'diperbarui_pada').join(', ')})`,
    });

    res.json({ data, pesan: 'Kop surat berhasil disimpan.' });
  } catch (err) { next(err); }
});

export default router;
