import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const WARNA = {
  brand: 'bg-brand-50 text-brand-700',
  amber: 'bg-amber-50 text-amber-700',
  sky: 'bg-sky-50 text-sky-700',
  rose: 'bg-rose-50 text-rose-700',
  slate: 'bg-slate-100 text-slate-600',
};

const GAYA_TREN = {
  naik: { ikon: TrendingUp, kelas: 'bg-brand-50 text-brand-700' },
  turun: { ikon: TrendingDown, kelas: 'bg-rose-50 text-rose-700' },
  sama: { ikon: Minus, kelas: 'bg-slate-100 text-slate-500' },
};

/**
 * Kartu angka ringkas untuk dashboard.
 *
 * `tren` sengaja opsional dan hanya diisi bila memang ada pembandingnya.
 * Aplikasi ini tidak menyimpan potret stok harian, jadi angka seperti
 * jumlah unit rusak tidak punya riwayat untuk dibandingkan — memberi panah
 * naik/turun di sana sama saja mengarang.
 */
export default function StatCard({ ikon: Ikon, label, nilai, satuan, catatan, warna = 'brand', tren }) {
  const gayaTren = tren ? GAYA_TREN[tren.arah] : null;

  return (
    <div className="group flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${WARNA[warna]}`}>
        <Ikon size={20} strokeWidth={2} />
      </div>

      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>

        <div className="flex flex-wrap items-baseline gap-x-2">
          <p className="font-display text-2xl font-bold leading-tight text-ink-900">
            {nilai}
            {satuan && <span className="ml-1 text-sm font-medium text-slate-400">{satuan}</span>}
          </p>

          {gayaTren && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${gayaTren.kelas}`}
              title={tren.keterangan}
            >
              <gayaTren.ikon size={12} />
              {tren.nilai}
            </span>
          )}
        </div>

        {(tren?.keterangan || catatan) && (
          <p className="mt-0.5 truncate text-xs text-slate-400">{tren?.keterangan || catatan}</p>
        )}
      </div>
    </div>
  );
}
