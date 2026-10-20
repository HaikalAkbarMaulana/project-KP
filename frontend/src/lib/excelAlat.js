/**
 * Pembacaan berkas Excel data inventaris.
 *
 * Sejalan dengan lib/excelGuru.js: judul kolom templat dan judul kolom yang
 * dibaca saat impor berasal dari satu sumber yang sama, jadi tidak mungkin
 * berbeda.
 */

export const KOLOM = [
  'Kode Alat', 'Nama Alat', 'Kategori', 'Ruangan',
  'Jumlah Baik', 'Jumlah Rusak', 'Merk/Tipe', 'Nomor Seri',
  'Tahun Perolehan', 'Sumber Dana', 'Harga Satuan', 'Boleh Dipinjam', 'Deskripsi',
];

/** Kolom yang wajib diisi. Sisanya boleh dikosongkan. */
export const KOLOM_WAJIB = ['Kode Alat', 'Nama Alat', 'Jumlah Baik'];

export const SUMBER_DANA = ['BOS', 'APBD', 'APBN', 'Hibah', 'Komite', 'Lainnya'];

export const CONTOH = [
  ['IPA-010', 'Gelas Ukur 100 ml', 'Alat Gelas & Bahan', 'Lab IPA', 12, 0, 'Pyrex', '', 2023, 'BOS', 45000, 'Ya', 'Untuk praktikum pengukuran volume'],
  ['KOM-010', 'Proyektor Mini', 'Perangkat Komputer', 'Lab Komputer', 2, 1, 'Epson EB-X51', 'SN-99812', 2022, 'APBD', 5200000, 'Ya', ''],
  ['MEB-001', 'Meja Praktikum', 'Mebelair Lab', 'Lab IPA', 20, 0, '', '', 2019, 'Komite', '', 'Tidak', 'Tidak dipinjamkan keluar lab'],
];

/** Penulisan judul kolom yang diterima, supaya daftar lama sekolah tetap terbaca. */
const SINONIM = {
  kode_alat: ['kode alat', 'kode', 'kode barang', 'kode inventaris'],
  nama_alat: ['nama alat', 'nama', 'nama barang'],
  kategori: ['kategori', 'jenis', 'jenis alat'],
  ruangan: ['ruangan', 'ruang', 'lokasi', 'tempat'],
  jumlah_baik: ['jumlah baik', 'jumlah layak pakai', 'layak pakai', 'baik', 'jumlah'],
  jumlah_rusak: ['jumlah rusak', 'rusak'],
  merk_tipe: ['merk/tipe', 'merk', 'merek', 'tipe', 'merk tipe', 'merek/tipe'],
  nomor_seri: ['nomor seri', 'no seri', 'no. seri', 'serial', 'sn'],
  tahun_perolehan: ['tahun perolehan', 'tahun', 'tahun pengadaan'],
  sumber_dana: ['sumber dana', 'sumber', 'dana'],
  harga_satuan: ['harga satuan', 'harga', 'nilai', 'harga beli'],
  boleh_dipinjam: ['boleh dipinjam', 'dipinjamkan', 'bisa dipinjam'],
  deskripsi: ['deskripsi', 'keterangan', 'catatan'],
};

function samakan(teks) {
  return String(teks).trim().toLowerCase().replace(/\s+/g, ' ');
}

function ambilKolom(baris, bidang) {
  const diterima = SINONIM[bidang];
  for (const [judul, nilai] of Object.entries(baris)) {
    if (diterima.includes(samakan(judul))) {
      if (nilai !== undefined && nilai !== null && String(nilai).trim() !== '') return nilai;
    }
  }
  return '';
}

/** Teks apa adanya, termasuk bila Excel membacanya sebagai angka. */
function teks(nilai) {
  if (nilai === undefined || nilai === null) return '';
  // Kode alat seperti "001" akan kehilangan nol di depan bila terbaca angka.
  // Tidak bisa dipulihkan, tapi menjadikannya teks mencegah notasi ilmiah.
  if (typeof nilai === 'number') return Number.isInteger(nilai) ? String(nilai) : String(nilai);
  return String(nilai).trim();
}

/** Angka dari sel yang mungkin berisi teks ber-pemisah ribuan ("1.500.000"). */
function angka(nilai) {
  if (nilai === undefined || nilai === null || String(nilai).trim() === '') return null;
  if (typeof nilai === 'number') return nilai;

  const bersih = String(nilai).replace(/[^\d,.-]/g, '');
  // Titik dipakai sebagai pemisah ribuan di Indonesia, koma sebagai desimal.
  const n = Number(bersih.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** "Ya"/"Tidak" menjadi boolean. Kosong berarti boleh dipinjam. */
function yaTidak(nilai) {
  const t = samakan(nilai);
  if (t === '') return true;
  if (['tidak', 't', 'no', 'n', 'false', '0'].includes(t)) return false;
  return true;
}

/** Mengubah hasil mentah SheetJS menjadi baris siap kirim. */
export function bacaBarisAlat(mentah) {
  return mentah
    .map((r) => {
      const sumber = teks(ambilKolom(r, 'sumber_dana'));
      // Dicocokkan tanpa membedakan huruf besar-kecil; "bos" tetap jadi "BOS".
      const sumberSah = SUMBER_DANA.find((s) => samakan(s) === samakan(sumber));

      return {
        kode_alat: teks(ambilKolom(r, 'kode_alat')),
        nama_alat: teks(ambilKolom(r, 'nama_alat')),
        kategori: teks(ambilKolom(r, 'kategori')),
        ruangan: teks(ambilKolom(r, 'ruangan')),
        jumlah_baik: angka(ambilKolom(r, 'jumlah_baik')) ?? 0,
        jumlah_rusak: angka(ambilKolom(r, 'jumlah_rusak')) ?? 0,
        merk_tipe: teks(ambilKolom(r, 'merk_tipe')) || null,
        nomor_seri: teks(ambilKolom(r, 'nomor_seri')) || null,
        tahun_perolehan: angka(ambilKolom(r, 'tahun_perolehan')),
        // Sumber dana yang tidak dikenali dibiarkan kosong, bukan ditebak —
        // menebak akan mencatat sumber anggaran yang salah di buku inventaris.
        sumber_dana: sumberSah ?? null,
        harga_satuan: angka(ambilKolom(r, 'harga_satuan')),
        boleh_dipinjam: yaTidak(ambilKolom(r, 'boleh_dipinjam')),
        deskripsi: teks(ambilKolom(r, 'deskripsi')) || null,
      };
    })
    .filter((r) => r.kode_alat || r.nama_alat);
}

/** Menyusun templat Excel. Kolom Kode Alat dipaksa teks agar nol di depan selamat. */
export function buatTemplat(XLSX) {
  const ws = XLSX.utils.aoa_to_sheet([KOLOM, ...CONTOH]);

  for (let baris = 2; baris <= CONTOH.length + 1; baris += 1) {
    const sel = ws[`A${baris}`];
    if (sel) {
      sel.t = 's';
      sel.z = '@';
    }
  }

  ws['!cols'] = [
    { wch: 12 }, { wch: 28 }, { wch: 20 }, { wch: 16 }, { wch: 11 }, { wch: 12 },
    { wch: 16 }, { wch: 14 }, { wch: 15 }, { wch: 13 }, { wch: 14 }, { wch: 14 }, { wch: 32 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data Alat');
  return wb;
}
