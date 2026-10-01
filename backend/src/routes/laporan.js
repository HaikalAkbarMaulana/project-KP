import { Router } from 'express';
import { supabaseAdmin } from '../supabaseClient.js';
import { wajibAdmin } from '../middleware/auth.js';
import { SEMUA_STATUS } from './peminjaman.js';
import * as v from '../lib/validasi.js';
import { galatValidasi } from '../lib/galat.js';

const router = Router();

const BATAS_BARIS = 10_000;

/**
 * Menyusun satu sel CSV.
 *
 * Dua hal yang ditangani di sini:
 *  - tanda kutip, titik koma, dan baris baru dibungkus tanda kutip ganda;
 *  - sel yang diawali = + - @ diberi tanda kutip tunggal di depan, karena
 *    Excel/LibreOffice memperlakukan awalan itu sebagai rumus. Tanpa ini,
 *    nama alat seperti "=Mikroskop" bisa dieksekusi saat berkas dibuka.
 */
function sel(nilai) {
  if (nilai === null || nilai === undefined) return '';
  let teks = String(nilai);
  if (/^[=+\-@\t\r]/.test(teks)) teks = `'${teks}`;
  if (/["\n;,]/.test(teks)) teks = `"${teks.replace(/"/g, '""')}"`;
  return teks;
}

/**
 * Merangkai berkas CSV.
 *
 * Pemisahnya titik koma dan diawali BOM UTF-8, karena Excel berbahasa
 * Indonesia membaca koma sebagai desimal dan tanpa BOM huruf beraksen jadi
 * berantakan.
 */
function susunCsv(judulKolom, baris) {
  const isi = [judulKolom, ...baris].map((r) => r.map(sel).join(';')).join('\r\n');
  return `﻿${isi}\r\n`;
}

function kirimCsv(res, namaBerkas, isi) {
  const stempel = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${namaBerkas}-${stempel}.csv"`);
  res.send(isi);
}

const tanggalId = (nilai) =>
  nilai ? new Date(nilai).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

// GET /api/laporan/rekap — angka rekapitulasi untuk laporan cetak (ADMIN)
//
// Dihitung di sini, bukan di browser, supaya seluruh peminjaman dalam
// rentang ikut terhitung — bukan hanya yang kebetulan tampil di halaman
// tabel yang sedang dibuka.
router.get('/rekap', wajibAdmin, async (req, res, next) => {
  try {
    const dari = v.tanggal(req.query.dari, 'Tanggal mulai', { wajib: true });
    const sampai = v.tanggal(req.query.sampai, 'Tanggal akhir', { wajib: true });

    if (sampai < dari) {
      throw galatValidasi('Tanggal akhir tidak boleh lebih awal dari tanggal mulai.');
    }

    const { data, error } = await supabaseAdmin
      .from('peminjaman')
      .select(`
        kode_peminjaman, nama_peminjam, nip_peminjam, mapel, jumlah, keperluan,
        tanggal_pinjam, tanggal_rencana_kembali, tanggal_kembali_aktual,
        status, jumlah_kembali_rusak, jumlah_hilang,
        alat:alat_id(kode_alat, nama_alat)
      `)
      .gte('tanggal_pinjam', dari)
      .lte('tanggal_pinjam', sampai)
      .order('tanggal_pinjam')
      .limit(BATAS_BARIS);

    if (error) throw error;
    const daftar = data ?? [];

    const ringkasan = {
      totalPengajuan: daftar.length,
      totalUnit: 0,
      unitRusak: 0,
      unitHilang: 0,
      perStatus: Object.fromEntries(SEMUA_STATUS.map((s) => [s, 0])),
      jumlahPeminjam: new Set(daftar.map((p) => p.nama_peminjam.toLowerCase())).size,
    };

    const perAlat = new Map();

    for (const p of daftar) {
      ringkasan.perStatus[p.status] = (ringkasan.perStatus[p.status] || 0) + 1;
      ringkasan.totalUnit += p.jumlah;
      ringkasan.unitRusak += p.jumlah_kembali_rusak || 0;
      ringkasan.unitHilang += p.jumlah_hilang || 0;

      const kunci = p.alat?.kode_alat || '-';
      const baris = perAlat.get(kunci) || {
        kode: kunci,
        nama: p.alat?.nama_alat || '(alat terhapus)',
        kali: 0, unit: 0, rusak: 0, hilang: 0,
      };
      baris.kali += 1;
      baris.unit += p.jumlah;
      baris.rusak += p.jumlah_kembali_rusak || 0;
      baris.hilang += p.jumlah_hilang || 0;
      perAlat.set(kunci, baris);
    }

    res.json({
      data: {
        periode: { dari, sampai },
        ringkasan,
        perAlat: [...perAlat.values()].sort((a, b) => b.unit - a.unit),
        daftar,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/laporan/inventaris.csv — Buku Inventaris Barang (ADMIN)
router.get('/inventaris.csv', wajibAdmin, async (req, res, next) => {
  try {
    let query = supabaseAdmin
      .from('alat')
      .select('*, kategori:kategori_id(nama_kategori), ruangan:ruangan_id(nama_ruangan)')
      .order('kode_alat')
      .limit(BATAS_BARIS);

    const ruanganId = v.uuid(req.query.ruangan_id, 'Ruangan');
    if (ruanganId) query = query.eq('ruangan_id', ruanganId);

    const kategoriId = v.uuid(req.query.kategori_id, 'Kategori');
    if (kategoriId) query = query.eq('kategori_id', kategoriId);

    const { data, error } = await query;
    if (error) throw error;

    const baris = (data ?? []).map((a, i) => [
      i + 1,
      a.kode_alat,
      a.nama_alat,
      a.merk_tipe,
      a.nomor_seri,
      a.kategori?.nama_kategori,
      a.ruangan?.nama_ruangan,
      a.jumlah_baik,
      a.jumlah_rusak,
      a.jumlah_dipinjam,
      a.jumlah_total,
      a.jumlah_tersedia,
      a.tahun_perolehan,
      a.sumber_dana,
      a.harga_satuan ?? '',
      a.harga_satuan ? Number(a.harga_satuan) * a.jumlah_total : '',
      a.boleh_dipinjam ? 'Ya' : 'Tidak',
      a.deskripsi,
    ]);

    kirimCsv(res, 'inventaris-lab', susunCsv(
      [
        'No', 'Kode Alat', 'Nama Alat', 'Merk/Tipe', 'Nomor Seri', 'Kategori', 'Ruangan',
        'Jumlah Baik', 'Jumlah Rusak', 'Sedang Dipinjam', 'Jumlah Total', 'Tersedia',
        'Tahun Perolehan', 'Sumber Dana', 'Harga Satuan', 'Nilai Total', 'Boleh Dipinjam', 'Keterangan',
      ],
      baris
    ));
  } catch (err) {
    next(err);
  }
});

// GET /api/laporan/peminjaman.csv — riwayat peminjaman (ADMIN)
router.get('/peminjaman.csv', wajibAdmin, async (req, res, next) => {
  try {
    let query = supabaseAdmin
      .from('peminjaman')
      .select('*, alat:alat_id(kode_alat, nama_alat), petugas:diproses_oleh(nama)')
      .order('dibuat_pada', { ascending: false })
      .limit(BATAS_BARIS);

    const status = v.pilihan(req.query.status, 'Status', SEMUA_STATUS);
    if (status) query = query.eq('status', status);

    const dari = v.tanggal(req.query.dari, 'Tanggal mulai');
    if (dari) query = query.gte('tanggal_pinjam', dari);

    const sampai = v.tanggal(req.query.sampai, 'Tanggal akhir');
    if (sampai) query = query.lte('tanggal_pinjam', sampai);

    const { data, error } = await query;
    if (error) throw error;

    const baris = (data ?? []).map((p, i) => [
      i + 1,
      p.kode_peminjaman,
      p.nama_peminjam,
      p.nip_peminjam,
      p.mapel,
      p.no_hp,
      p.alat?.kode_alat,
      p.alat?.nama_alat,
      p.jumlah,
      p.keperluan,
      tanggalId(p.tanggal_pinjam),
      tanggalId(p.tanggal_rencana_kembali),
      tanggalId(p.tanggal_kembali_aktual),
      p.status,
      p.catatan_admin,
      p.petugas?.nama,
    ]);

    kirimCsv(res, 'riwayat-peminjaman', susunCsv(
      [
        'No', 'Kode Peminjaman', 'Nama Peminjam', 'NIP/NUPTK', 'Mata Pelajaran', 'No. HP',
        'Kode Alat', 'Nama Alat', 'Jumlah', 'Keperluan',
        'Tanggal Pinjam', 'Rencana Kembali', 'Tanggal Kembali', 'Status', 'Catatan Admin', 'Diproses Oleh',
      ],
      baris
    ));
  } catch (err) {
    next(err);
  }
});

export default router;
