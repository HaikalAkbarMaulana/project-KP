export const STATUS_LABEL = {
  pending: 'Menunggu',
  disetujui: 'Disetujui',
  dipinjam: 'Sedang Dipinjam',
  dikembalikan: 'Sudah Kembali',
  ditolak: 'Ditolak',
  dibatalkan: 'Dibatalkan',
};

export const STATUS_WARNA = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  disetujui: 'bg-brand-50 text-brand-700 ring-brand-200',
  dipinjam: 'bg-sky-50 text-sky-700 ring-sky-200',
  dikembalikan: 'bg-slate-100 text-slate-600 ring-slate-200',
  ditolak: 'bg-rose-50 text-rose-700 ring-rose-200',
  dibatalkan: 'bg-slate-100 text-slate-500 ring-slate-200',
};

export const SUMBER_DANA = ['BOS', 'APBD', 'APBN', 'Hibah', 'Komite', 'Lainnya'];

const formatRupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

export const rupiah = (nilai) => formatRupiah.format(Number(nilai) || 0);

export const angka = (nilai) => new Intl.NumberFormat('id-ID').format(Number(nilai) || 0);

export function tanggalSingkat(nilai) {
  if (!nilai) return '-';
  return new Date(nilai).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function waktuLengkap(nilai) {
  if (!nilai) return '-';
  return new Date(nilai).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/** Selisih hari dari hari ini; negatif berarti sudah lewat. */
export function sisaHari(tanggal) {
  if (!tanggal) return null;
  const target = new Date(`${String(tanggal).slice(0, 10)}T00:00:00`);
  const sekarang = new Date();
  sekarang.setHours(0, 0, 0, 0);
  return Math.round((target - sekarang) / 86_400_000);
}

export const tanggalHariIni = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD waktu lokal
