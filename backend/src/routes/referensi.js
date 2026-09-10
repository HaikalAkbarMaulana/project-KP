import { Router } from 'express';
import { supabaseAdmin } from '../supabaseClient.js';
import { wajibAdmin } from '../middleware/auth.js';
import { catatAktivitas } from '../lib/log.js';
import { galatTidakDitemukan, galatValidasi, galatKonflik } from '../lib/galat.js';
import * as v from '../lib/validasi.js';

const router = Router();

/**
 * Membuat CRUD untuk tabel referensi (ruangan & kategori).
 *
 * `susunPayload` menentukan kolom mana saja yang boleh ditulis klien. Versi
 * sebelumnya meneruskan req.body langsung ke Supabase, sehingga siapa pun
 * yang punya sesi admin bisa mengirim kolom sembarangan seperti id atau
 * dibuat_pada.
 */
function buatRouteReferensi({ tabel, kolomNama, label, susunPayload }) {
  const r = Router();

  // Daftar dipakai juga oleh halaman publik untuk filter katalog.
  r.get('/', async (req, res, next) => {
    try {
      const { data, error } = await supabaseAdmin.from(tabel).select('*').order(kolomNama);
      if (error) throw error;
      res.json({ data });
    } catch (err) { next(err); }
  });

  r.post('/', wajibAdmin, async (req, res, next) => {
    try {
      const payload = susunPayload(req.body, { untukPembuatan: true });

      const { data, error } = await supabaseAdmin.from(tabel).insert(payload).select().single();
      if (error) {
        if (error.code === '23505') throw galatKonflik(`${label} "${payload[kolomNama]}" sudah ada.`);
        throw error;
      }

      await catatAktivitas({
        admin: req.admin,
        aksi: `Menambah ${label.toLowerCase()}`,
        keterangan: `Menambahkan ${label.toLowerCase()} "${data[kolomNama]}"`,
      });

      res.status(201).json({ data });
    } catch (err) { next(err); }
  });

  r.put('/:id', wajibAdmin, async (req, res, next) => {
    try {
      const id = v.uuid(req.params.id, `ID ${label.toLowerCase()}`, { wajib: true });
      const payload = susunPayload(req.body, { untukPembuatan: false });

      if (Object.keys(payload).length === 0) throw galatValidasi('Tidak ada data yang diubah.');

      const { data, error } = await supabaseAdmin
        .from(tabel).update(payload).eq('id', id).select().maybeSingle();

      if (error) {
        if (error.code === '23505') throw galatKonflik(`${label} dengan nama itu sudah ada.`);
        throw error;
      }
      if (!data) throw galatTidakDitemukan(`${label} tidak ditemukan.`);

      res.json({ data });
    } catch (err) { next(err); }
  });

  r.delete('/:id', wajibAdmin, async (req, res, next) => {
    try {
      const id = v.uuid(req.params.id, `ID ${label.toLowerCase()}`, { wajib: true });

      // Alat yang menunjuk ke sini memakai "on delete set null", jadi
      // penghapusan tidak akan gagal — alatnya hanya jadi tanpa kategori/
      // ruangan. Petugas lab perlu tahu itu sebelum terlanjur.
      const { count, error: errHitung } = await supabaseAdmin
        .from('alat')
        .select('id', { count: 'exact', head: true })
        .eq(tabel === 'ruangan' ? 'ruangan_id' : 'kategori_id', id);

      if (errHitung) throw errHitung;
      if (count > 0 && !v.boolean(req.query.paksa, false)) {
        throw galatKonflik(
          `${label} ini masih dipakai ${count} alat. Pindahkan alat tersebut dulu, ` +
          'atau ulangi penghapusan untuk melepas keterkaitannya.'
        );
      }

      const { data, error } = await supabaseAdmin
        .from(tabel).delete().eq('id', id).select(kolomNama).maybeSingle();

      if (error) throw error;
      if (!data) throw galatTidakDitemukan(`${label} tidak ditemukan.`);

      await catatAktivitas({
        admin: req.admin,
        aksi: `Menghapus ${label.toLowerCase()}`,
        keterangan: `Menghapus ${label.toLowerCase()} "${data[kolomNama]}"`,
      });

      res.json({ pesan: `${label} "${data[kolomNama]}" berhasil dihapus.` });
    } catch (err) { next(err); }
  });

  return r;
}

const routeRuangan = buatRouteReferensi({
  tabel: 'ruangan',
  kolomNama: 'nama_ruangan',
  label: 'Ruangan',
  susunPayload(body, { untukPembuatan }) {
    const payload = {
      // Boleh tidak dikirim saat memperbarui, tapi tidak boleh dikosongkan.
      nama_ruangan: v.teks(body.nama_ruangan, 'Nama ruangan', {
        wajib: untukPembuatan || body.nama_ruangan !== undefined, maks: 100,
      }),
      keterangan: v.teks(body.keterangan, 'Keterangan', { maks: 300 }),
      penanggung_jawab: v.teks(body.penanggung_jawab, 'Penanggung jawab', { maks: 120 }),
    };
    return untukPembuatan ? payload : v.tanpaUndefined(payload);
  },
});

const routeKategori = buatRouteReferensi({
  tabel: 'kategori',
  kolomNama: 'nama_kategori',
  label: 'Kategori',
  susunPayload(body, { untukPembuatan }) {
    const payload = {
      nama_kategori: v.teks(body.nama_kategori, 'Nama kategori', {
        wajib: untukPembuatan || body.nama_kategori !== undefined, maks: 100,
      }),
    };
    return untukPembuatan ? payload : v.tanpaUndefined(payload);
  },
});

router.use('/ruangan', routeRuangan);
router.use('/kategori', routeKategori);

export default router;
