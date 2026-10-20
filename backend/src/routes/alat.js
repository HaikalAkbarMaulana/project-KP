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

/**
 * Batas baris sekali unggah.
 *
 * Alat disisipkan satu per satu supaya tiap baris bisa dilaporkan nasibnya
 * sendiri. Batas ini menjaga satu permintaan tidak berjalan begitu lama
 * sampai ditutup paksa di tengah jalan.
 */
const MAKS_BARIS_IMPOR = 300;

/** Mencocokkan nama tanpa membedakan huruf besar-kecil maupun spasi berlebih. */
function kunciNama(teks) {
  return String(teks).trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Mendaftarkan banyak alat sekaligus, melaporkan nasib tiap baris.
 *
 * Dipisahkan dari rutenya supaya bisa diuji tanpa perlu sesi admin.
 */
export async function imporBanyakAlat(baris) {
  if (!Array.isArray(baris) || baris.length === 0) {
    throw galatValidasi('Tidak ada baris yang bisa dibaca dari berkas.');
  }
  if (baris.length > MAKS_BARIS_IMPOR) {
    throw galatValidasi(
      `Sekali unggah maksimal ${MAKS_BARIS_IMPOR} baris. Berkas ini berisi ${baris.length} baris — ` +
      'bagi dua lalu unggah bergantian.'
    );
  }

  // Kategori, ruangan, dan kode yang sudah ada diambil sekali di awal, bukan
  // ditanyakan per baris — 300 baris jangan berarti 900 perjalanan tambahan.
  const [kategori, ruangan, alatAda] = await Promise.all([
    supabaseAdmin.from('kategori').select('id, nama_kategori'),
    supabaseAdmin.from('ruangan').select('id, nama_ruangan'),
    supabaseAdmin.from('alat').select('kode_alat'),
  ]);
  for (const r of [kategori, ruangan, alatAda]) if (r.error) throw r.error;

  const petaKategori = new Map((kategori.data ?? []).map((k) => [kunciNama(k.nama_kategori), k.id]));
  const petaRuangan = new Map((ruangan.data ?? []).map((r) => [kunciNama(r.nama_ruangan), r.id]));
  const sudahAda = new Set((alatAda.data ?? []).map((a) => kunciNama(a.kode_alat)));
  const adaDiBerkas = new Set();

  const hasil = [];
  let dibuat = 0;
  let dilewati = 0;
  let gagal = 0;

  for (const [i, mentah] of baris.entries()) {
    // Nomor baris mengikuti tampilan Excel: baris 1 adalah judul kolom.
    const nomor = i + 2;
    const kode = String(mentah?.kode_alat ?? '').trim();
    const nama = String(mentah?.nama_alat ?? '').trim();

    try {
      // Nama kategori/ruangan diterjemahkan ke id lebih dulu. Nama yang
      // tidak dikenali DITOLAK, bukan dibuatkan kategori baru: satu salah
      // ketik akan melahirkan kategori sampah yang tidak disadari siapa pun,
      // dan merapikannya jauh lebih repot daripada membetulkan satu sel.
      const payload = { ...mentah };
      for (const [kolom, peta, label, daftar] of [
        ['kategori', petaKategori, 'Kategori', kategori.data?.map((k) => k.nama_kategori)],
        ['ruangan', petaRuangan, 'Ruangan', ruangan.data?.map((r) => r.nama_ruangan)],
      ]) {
        const teks = String(mentah?.[kolom] ?? '').trim();
        delete payload[kolom];
        if (!teks) continue;

        const id = peta.get(kunciNama(teks));
        if (!id) {
          throw galatValidasi(
            `${label} "${teks}" belum terdaftar. Tambahkan dulu di menu ${label}, ` +
            `atau pakai salah satu dari: ${(daftar ?? []).join(', ')}.`
          );
        }
        payload[`${kolom}_id`] = id;
      }

      const siap = susunPayloadAlat(payload, { untukPembuatan: true });

      if (sudahAda.has(kunciNama(siap.kode_alat))) {
        dilewati += 1;
        hasil.push({ nomor, nama: nama || kode, status: 'dilewati', pesan: 'Kode alat sudah terdaftar.' });
        continue;
      }
      if (adaDiBerkas.has(kunciNama(siap.kode_alat))) {
        gagal += 1;
        hasil.push({ nomor, nama: nama || kode, status: 'gagal', pesan: 'Kode alat ganda di dalam berkas ini.' });
        continue;
      }

      const { error } = await supabaseAdmin.from('alat').insert(siap);
      if (error) {
        throw error.code === '23505'
          ? galatKonflik(`Kode alat "${siap.kode_alat}" sudah dipakai alat lain.`)
          : error;
      }

      adaDiBerkas.add(kunciNama(siap.kode_alat));
      dibuat += 1;
      hasil.push({ nomor, nama: siap.nama_alat, status: 'berhasil', pesan: '' });
    } catch (err) {
      // Satu baris bermasalah tidak membatalkan sisanya; nasib tiap baris
      // dilaporkan apa adanya.
      gagal += 1;
      hasil.push({ nomor, nama: nama || kode, status: 'gagal', pesan: err.message });
    }
  }

  return { ringkasan: { terbaca: baris.length, dibuat, dilewati, gagal }, baris: hasil };
}

// POST /api/alat/impor — mendaftarkan banyak alat sekaligus (ADMIN)
//
// Berkas Excel-nya dibaca di browser lalu dikirim ke sini sebagai baris
// JSON, jadi backend tidak perlu menangani unggahan berkas. Tiap baris
// tetap divalidasi ulang di sini.
router.post('/impor', wajibAdmin, async (req, res, next) => {
  try {
    const data = await imporBanyakAlat(req.body?.baris);
    const { dibuat, dilewati, gagal } = data.ringkasan;

    if (dibuat > 0) {
      await catatAktivitas({
        admin: req.admin,
        aksi: 'Impor data alat',
        keterangan: `Mengimpor ${dibuat} alat dari berkas Excel (${dilewati} dilewati, ${gagal} gagal)`,
      });
    }

    res.json({
      data,
      pesan:
        gagal === 0 && dilewati === 0
          ? `${dibuat} alat berhasil ditambahkan.`
          : `${dibuat} alat ditambahkan, ${dilewati} dilewati, ${gagal} gagal. Periksa rinciannya di bawah.`,
    });
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
