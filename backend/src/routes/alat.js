import { Router } from 'express';
import { supabaseAdmin } from '../supabaseClient.js';
import { wajibAdmin, kenaliAdmin } from '../middleware/auth.js';
import { catatAktivitas } from '../lib/log.js';
import { hapusFotoAlat } from '../lib/penyimpanan.js';
import {
  galatTidakDitemukan,
  galatValidasi,
  galatKonflik,
  karenaHalamanDiLuarJangkauan,
  totalDariGalatJangkauan,
} from '../lib/galat.js';
import * as v from '../lib/validasi.js';

const router = Router();

export const SUMBER_DANA = ['BOS', 'APBD', 'APBN', 'Hibah', 'Komite', 'Lainnya'];

const RELASI = 'kategori:kategori_id(id, nama_kategori), ruangan:ruangan_id(id, nama_ruangan)';

// Katalog publik sengaja tidak memuat harga perolehan, nomor seri, dan
// sumber dana — itu data administrasi aset yang tidak perlu dilihat umum.
const KOLOM_PUBLIK = `
  id, kode_alat, nama_alat, kategori_id, ruangan_id,
  jumlah_baik, jumlah_rusak, jumlah_total, jumlah_tersedia,
  merk_tipe, boleh_dipinjam, foto_url, deskripsi, ${RELASI}
`;

const KOLOM_ADMIN = `*, ${RELASI}`;

/**
 * Menyusun payload alat dari body permintaan.
 *
 * Hanya kolom di fungsi inilah yang boleh ditulis klien. jumlah_dipinjam,
 * jumlah_total, dan jumlah_tersedia sengaja tidak ada di sini: dua yang
 * terakhir dihitung PostgreSQL, dan yang pertama hanya boleh diubah trigger
 * peminjaman. Tanpa penyaringan ini, siapa pun yang punya sesi admin bisa
 * mengirim jumlah_dipinjam sembarangan dan merusak konsistensi stok.
 */
function susunPayloadAlat(body, { untukPembuatan }) {
  // Kode dan nama tidak boleh dikosongkan. Pada pembaruan keduanya boleh
  // saja tidak dikirim (berarti tidak diubah), tapi begitu dikirim isinya
  // wajib ada — tanpa aturan ini, mengirim string kosong akan mengubahnya
  // menjadi null dan ditolak database dengan pesan yang tidak informatif.
  const adaKode = body.kode_alat !== undefined;
  const adaNama = body.nama_alat !== undefined;

  const payload = {
    kode_alat: v.teks(body.kode_alat, 'Kode alat', { wajib: untukPembuatan || adaKode, maks: 50 }),
    nama_alat: v.teks(body.nama_alat, 'Nama alat', { wajib: untukPembuatan || adaNama, maks: 150 }),
    kategori_id: v.uuid(body.kategori_id, 'Kategori'),
    ruangan_id: v.uuid(body.ruangan_id, 'Ruangan'),
    jumlah_baik: v.bilangan(body.jumlah_baik, 'Jumlah layak pakai', {
      wajib: untukPembuatan, min: 0, maks: 100_000,
    }),
    jumlah_rusak: v.bilangan(body.jumlah_rusak, 'Jumlah rusak', {
      min: 0, maks: 100_000, bawaan: untukPembuatan ? 0 : undefined,
    }),
    merk_tipe: v.teks(body.merk_tipe, 'Merk / tipe', { maks: 120 }),
    nomor_seri: v.teks(body.nomor_seri, 'Nomor seri', { maks: 120 }),
    tahun_perolehan: v.bilangan(body.tahun_perolehan, 'Tahun perolehan', { min: 1950, maks: 2100 }),
    sumber_dana: v.pilihan(body.sumber_dana, 'Sumber dana', SUMBER_DANA),
    harga_satuan: v.desimal(body.harga_satuan, 'Harga satuan'),
    boleh_dipinjam: v.boolean(body.boleh_dipinjam, untukPembuatan ? true : undefined),
    foto_url: v.teks(body.foto_url, 'URL foto', { maks: 500 }),
    deskripsi: v.teks(body.deskripsi, 'Deskripsi', { maks: 2000 }),
  };

  // Pada pembaruan, kolom yang tidak dikirim harus dibiarkan apa adanya.
  return untukPembuatan ? payload : v.tanpaUndefined(payload);
}

// GET /api/alat — katalog inventaris (PUBLIK, mendukung filter & halaman)
router.get('/', kenaliAdmin, async (req, res, next) => {
  try {
    const halaman = v.bilangan(req.query.halaman, 'Halaman', { min: 1, maks: 10_000, bawaan: 1 });
    const perHalaman = v.bilangan(req.query.per_halaman, 'Jumlah per halaman', {
      min: 1, maks: 200, bawaan: 50,
    });
    const dari = (halaman - 1) * perHalaman;

    let query = supabaseAdmin
      .from('alat')
      .select(req.admin ? KOLOM_ADMIN : KOLOM_PUBLIK, { count: 'exact' })
      .order('nama_alat', { ascending: true })
      .range(dari, dari + perHalaman - 1);

    const pola = v.polaPencarian(req.query.q);
    if (pola) query = query.or(`nama_alat.ilike.${pola},kode_alat.ilike.${pola},merk_tipe.ilike.${pola}`);

    const kategoriId = v.uuid(req.query.kategori_id, 'Kategori');
    if (kategoriId) query = query.eq('kategori_id', kategoriId);

    const ruanganId = v.uuid(req.query.ruangan_id, 'Ruangan');
    if (ruanganId) query = query.eq('ruangan_id', ruanganId);

    const ketersediaan = v.pilihan(req.query.ketersediaan, 'Ketersediaan', ['tersedia', 'habis', 'rusak']);
    if (ketersediaan === 'tersedia') query = query.gt('jumlah_tersedia', 0);
    if (ketersediaan === 'habis') query = query.eq('jumlah_tersedia', 0);
    if (ketersediaan === 'rusak') query = query.gt('jumlah_rusak', 0);

    const { data, error, count } = await query;

    // Halaman yang diminta melewati jumlah data. Jawaban yang benar adalah
    // daftar kosong beserta total sebenarnya, bukan error — biar tombol
    // halaman di layar langsung menyesuaikan diri.
    if (karenaHalamanDiLuarJangkauan(error)) {
      return res.json({
        data: [],
        halaman: { nomor: halaman, per_halaman: perHalaman, total: totalDariGalatJangkauan(error) ?? 0 },
      });
    }
    if (error) throw error;

    res.json({
      data,
      halaman: { nomor: halaman, per_halaman: perHalaman, total: count ?? 0 },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/alat/:id — detail satu alat (PUBLIK)
router.get('/:id', kenaliAdmin, async (req, res, next) => {
  try {
    const id = v.uuid(req.params.id, 'ID alat', { wajib: true });

    const { data, error } = await supabaseAdmin
      .from('alat')
      .select(req.admin ? KOLOM_ADMIN : KOLOM_PUBLIK)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw galatTidakDitemukan('Alat tidak ditemukan.');

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// POST /api/alat — tambah alat (ADMIN)
router.post('/', wajibAdmin, async (req, res, next) => {
  try {
    const payload = susunPayloadAlat(req.body, { untukPembuatan: true });

    const { data, error } = await supabaseAdmin
      .from('alat')
      .insert(payload)
      .select(KOLOM_ADMIN)
      .single();

    if (error) {
      if (error.code === '23505') {
        throw galatKonflik(`Kode alat "${payload.kode_alat}" sudah dipakai alat lain.`);
      }
      throw error;
    }

    await catatAktivitas({
      admin: req.admin,
      aksi: 'Menambah alat',
      keterangan: `Menambahkan "${data.nama_alat}" sebanyak ${data.jumlah_total} unit`,
    });

    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
});

// PUT /api/alat/:id — ubah data alat (ADMIN)
router.put('/:id', wajibAdmin, async (req, res, next) => {
  try {
    const id = v.uuid(req.params.id, 'ID alat', { wajib: true });
    const payload = susunPayloadAlat(req.body, { untukPembuatan: false });

    if (Object.keys(payload).length === 0) {
      throw galatValidasi('Tidak ada data yang diubah.');
    }

    // Menurunkan jumlah_baik di bawah jumlah yang sedang dipinjam akan
    // ditolak constraint cek_dipinjam_wajar. Diperiksa lebih dulu di sini
    // supaya pesannya jelas bagi petugas lab.
    if (payload.jumlah_baik !== undefined) {
      const { data: sekarang, error: errCek } = await supabaseAdmin
        .from('alat')
        .select('jumlah_dipinjam, nama_alat')
        .eq('id', id)
        .maybeSingle();

      if (errCek) throw errCek;
      if (!sekarang) throw galatTidakDitemukan('Alat tidak ditemukan.');

      if (payload.jumlah_baik < sekarang.jumlah_dipinjam) {
        throw galatValidasi(
          `Saat ini ${sekarang.jumlah_dipinjam} unit sedang dipinjam, jadi jumlah layak pakai ` +
          `tidak bisa dikurangi sampai di bawah angka itu. Catat pengembaliannya dulu.`
        );
      }
    }

    const { data, error } = await supabaseAdmin
      .from('alat')
      .update(payload)
      .eq('id', id)
      .select(KOLOM_ADMIN)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw galatTidakDitemukan('Alat tidak ditemukan.');

    await catatAktivitas({
      admin: req.admin,
      aksi: 'Memperbarui alat',
      keterangan: `Memperbarui data "${data.nama_alat}"`,
    });

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/alat/:id — hapus alat (ADMIN)
router.delete('/:id', wajibAdmin, async (req, res, next) => {
  try {
    const id = v.uuid(req.params.id, 'ID alat', { wajib: true });

    const { data: alat, error: errAmbil } = await supabaseAdmin
      .from('alat')
      .select('nama_alat, jumlah_dipinjam, foto_url')
      .eq('id', id)
      .maybeSingle();

    if (errAmbil) throw errAmbil;
    if (!alat) throw galatTidakDitemukan('Alat tidak ditemukan.');

    if (alat.jumlah_dipinjam > 0) {
      throw galatValidasi(
        `"${alat.nama_alat}" masih dipinjam ${alat.jumlah_dipinjam} unit. ` +
        'Catat pengembaliannya dulu sebelum menghapus.'
      );
    }

    const { error } = await supabaseAdmin.from('alat').delete().eq('id', id);
    if (error) {
      // Alat yang punya riwayat peminjaman ditahan foreign key agar
      // riwayatnya tidak ikut hilang bersama alatnya.
      if (error.code === '23503') {
        throw galatKonflik(
          `"${alat.nama_alat}" sudah punya riwayat peminjaman sehingga tidak bisa dihapus. ` +
          'Sebagai gantinya, matikan opsi "boleh dipinjam" lewat tombol Edit.'
        );
      }
      throw error;
    }

    // Fotonya ikut dibuang agar tidak menumpuk sebagai berkas tanpa pemilik.
    await hapusFotoAlat(alat.foto_url);

    await catatAktivitas({
      admin: req.admin,
      aksi: 'Menghapus alat',
      keterangan: `Menghapus "${alat.nama_alat}" dari inventaris`,
    });

    res.json({ pesan: `"${alat.nama_alat}" berhasil dihapus.` });
  } catch (err) {
    next(err);
  }
});

export default router;
