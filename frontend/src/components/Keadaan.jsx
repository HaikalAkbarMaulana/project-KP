import { AlertCircle, Inbox, Loader2, RefreshCw } from 'lucide-react';

/** Penanda sedang memuat. */
export function Memuat({ pesan = 'Memuat data...' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500" role="status">
      <Loader2 size={18} className="animate-spin" />
      {pesan}
    </div>
  );
}

/**
 * Pesan kegagalan beserta tombol coba lagi.
 *
 * Sebelumnya kegagalan permintaan tidak ditangani sama sekali sehingga
 * pengguna hanya melihat halaman kosong tanpa tahu apa yang terjadi.
 */
export function PesanGalat({ pesan, onCobaLagi }) {
  if (!pesan) return null;

  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="flex items-start gap-2">
        <AlertCircle size={18} className="mt-px shrink-0" />
        {pesan}
      </span>
      {onCobaLagi && (
        <button
          type="button"
          onClick={onCobaLagi}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100"
        >
          <RefreshCw size={14} /> Coba lagi
        </button>
      )}
    </div>
  );
}

/** Pesan sukses ringkas. */
export function PesanSukses({ pesan }) {
  if (!pesan) return null;
  return (
    <p role="status" className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-800 ring-1 ring-brand-200">
      {pesan}
    </p>
  );
}

/** Keadaan kosong yang menjelaskan langkah berikutnya, bukan sekadar "tidak ada data". */
export function Kosong({ judul, keterangan, aksi }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <Inbox size={28} className="text-slate-300" />
      <p className="font-display font-semibold text-ink-900">{judul}</p>
      {keterangan && <p className="max-w-sm text-sm text-slate-500">{keterangan}</p>}
      {aksi}
    </div>
  );
}
