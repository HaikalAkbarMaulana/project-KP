import { Router } from 'express';
import { supabaseAdmin } from '../supabaseClient.js';
import { wajibAdmin } from '../middleware/auth.js';
import { SEMUA_STATUS } from './peminjaman.js';
import { tanggalLokal } from '../lib/waktu.js';

const router = Router();

// PostgREST membatasi jumlah baris yang dikembalikan. Batas eksplisit di
// bawah ini dipasang supaya ringkasan tidak diam-diam salah hitung ketika
// data inventaris sekolah bertambah banyak.
const BATAS_ALAT = 5000;
const BATAS_PEMINJAMAN = 5000;

function hariIni() {
  return tanggalLokal();
}

/** Daftar 6 bulan terakhir dalam bentuk { kunci: '2026-04', label: 'Apr 2026' }. */
function enamBulanTerakhir() {
  const bulan = [];
  const acuan = new Date();
  acuan.setDate(1);

  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(acuan.getFullYear(), acuan.getMonth() - i, 1);
    bulan.push({
      kunci: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
    });
  }
  return bulan;
}

// GET /api/dashboard/ringkasan — angka & grafik untuk panel admin
router.get('/ringkasan', wajibAdmin, async (req, res, next) => {
  try {
    const bulan = enamBulanTerakhir();
    const awalRentang = `${bulan[0].kunci}-01`;

    const [resAlat, resPeminjaman, resRuangan, resKategori, resLog] = await Promise.all([
      supabaseAdmin
        .from('alat')
        .select('id, nama_alat, jumlah_baik, jumlah_rusak, jumlah_total, jumlah_tersedia, jumlah_dipinjam, harga_satuan')
        .limit(BATAS_ALAT),
      supabaseAdmin
        .from('peminjaman')
        .select('status, jumlah, dibuat_pada, tanggal_rencana_kembali, alat_id, alat:alat_id(nama_alat)')
        .gte('dibuat_pada', `${awalRentang}T00:00:00Z`)
        .limit(BATAS_PEMINJAMAN),
      supabaseAdmin.from('ruangan').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('kategori').select('id', { count: 'exact', head: true }),
      supabaseAdmin
        .from('log_aktivitas')
        .select('id, aksi, keterangan, aktor_nama, dibuat_pada')
        .order('dibuat_pada', { ascending: false })
        .limit(8),
    ]);

    for (const hasil of [resAlat, resPeminjaman, resRuangan, resKategori, resLog]) {
      if (hasil.error) throw hasil.error;
    }

    const daftarAlat = resAlat.data ?? [];
    const daftarPeminjaman = resPeminjaman.data ?? [];

    // Kondisi dihitung per UNIT, bukan per baris inventaris. Satu baris
    // "Mikroskop" berisi 20 unit harus terbaca 20, bukan 1 — versi
    // sebelumnya menghitung barisnya sehingga grafiknya menyesatkan.
    const unit = daftarAlat.reduce(
      (jml, a) => ({
        baik: jml.baik + a.jumlah_baik,
        rusak: jml.rusak + a.jumlah_rusak,
        dipinjam: jml.dipinjam + a.jumlah_dipinjam,
        tersedia: jml.tersedia + a.jumlah_tersedia,
        total: jml.total + a.jumlah_total,
      }),
      { baik: 0, rusak: 0, dipinjam: 0, tersedia: 0, total: 0 }
    );

    const nilaiAset = daftarAlat.reduce(
      (jml, a) => jml + Number(a.harga_satuan || 0) * a.jumlah_total,
      0
    );

    const statusRingkasan = Object.fromEntries(SEMUA_STATUS.map((s) => [s, 0]));
    const perBulan = Object.fromEntries(bulan.map((b) => [b.kunci, 0]));
    const seringDipinjam = new Map();

    for (const p of daftarPeminjaman) {
      statusRingkasan[p.status] = (statusRingkasan[p.status] || 0) + 1;

      const kunciBulan = p.dibuat_pada.slice(0, 7);
      if (kunciBulan in perBulan) perBulan[kunciBulan] += 1;

      const nama = p.alat?.nama_alat;
      if (nama) seringDipinjam.set(nama, (seringDipinjam.get(nama) || 0) + p.jumlah);
    }

    const tanggalHariIni = hariIni();
    const terlambat = daftarPeminjaman.filter(
      (p) => p.status === 'dipinjam' && p.tanggal_rencana_kembali < tanggalHariIni
    ).length;

    res.json({
      data: {
        // Kartu statistik
        totalJenisAlat: daftarAlat.length,
        totalUnit: unit.total,
        unitTersedia: unit.tersedia,
        unitDipinjam: unit.dipinjam,
        unitRusak: unit.rusak,
        totalRuangan: resRuangan.count ?? 0,
        totalKategori: resKategori.count ?? 0,
        nilaiAset,

        // Butuh tindakan
        menungguPersetujuan: statusRingkasan.pending,
        terlambatDikembalikan: terlambat,

        // Grafik
        kondisiUnit: [
          { nama: 'Layak pakai', jumlah: unit.baik },
          { nama: 'Rusak', jumlah: unit.rusak },
        ],
        statusRingkasan,
        peminjamanPerBulan: bulan.map((b) => ({ nama: b.label, jumlah: perBulan[b.kunci] })),
        alatSeringDipinjam: [...seringDipinjam.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([nama, jumlah]) => ({ nama, jumlah })),

        logTerbaru: resLog.data ?? [],
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
