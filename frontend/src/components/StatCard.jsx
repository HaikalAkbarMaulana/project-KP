const WARNA = {
  brand: 'bg-brand-50 text-brand-700',
  amber: 'bg-amber-50 text-amber-700',
  sky: 'bg-sky-50 text-sky-700',
  rose: 'bg-rose-50 text-rose-700',
  slate: 'bg-slate-100 text-slate-600',
};

export default function StatCard({ ikon: Ikon, label, nilai, satuan, catatan, warna = 'brand' }) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${WARNA[warna]}`}>
        <Ikon size={20} strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="font-display text-2xl font-bold leading-tight text-ink-900">
          {nilai}
          {satuan && <span className="ml-1 text-sm font-medium text-slate-400">{satuan}</span>}
        </p>
        {catatan && <p className="mt-0.5 truncate text-xs text-slate-400">{catatan}</p>}
      </div>
    </div>
  );
}
