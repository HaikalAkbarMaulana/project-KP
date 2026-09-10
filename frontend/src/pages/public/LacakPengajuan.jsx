import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Clock, CheckCircle2, XCircle, PackageOpen, PackageCheck, Ban } from 'lucide-react';

import { api } from '../../lib/api';
import { STATUS_LABEL, STATUS_WARNA, tanggalSingkat, sisaHari } from '../../lib/format';
import { PesanGalat } from '../../components/Keadaan';

const IKON_STATUS = {
  pending: Clock,
  disetujui: CheckCircle2,
  dipinjam: PackageOpen,
  dikembalikan: PackageCheck,
  ditolak: XCircle,
  dibatalkan: Ban,
};

const PENJELASAN = {
  pending: 'Pengajuan Anda sudah masuk dan sedang menunggu ditinjau petugas lab.',
  disetujui: 'Pengajuan disetujui. Silakan ambil alatnya ke petugas lab sesuai tanggal pinjam.',
  dipinjam: 'Alat sudah Anda ambil. Mohon dikembalikan sebelum tanggal rencana kembali.',
  dikembalikan: 'Alat sudah dikembalikan dan tercatat. Terima kasih.',
  ditolak: 'Pengajuan ini ditolak petugas lab. Lihat catatan di bawah bila ada.',
  dibatalkan: 'Pengajuan ini dibatalkan.',
};

export default function LacakPengajuan() {
  const [paramUrl, setParamUrl] = useSearchParams();
  const kodeAwal = paramUrl.get('kode') || '';

  const [kode, setKode] = useState(kodeAwal);
  const [hasil, setHasil] = useState(null);
  const [galat, setGalat] = useState('');
  const [mencari, setMencari] = useState(false);

  // Kode yang dibawa lewat alamat (misal dari halaman "pengajuan terkirim")
  // langsung dicari begitu halaman dibuka.
  useEffect(() => {
    if (!kodeAwal) return undefined;

    const kontrol = new AbortController();
    setMencari(true);
    setGalat('');

    api.get(`/peminjaman/lacak/${encodeURIComponent(kodeAwal)}`, { signal: kontrol.signal })
      .then((res) => setHasil(res.data))
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setHasil(null);
        setGalat(err.message);
      })
      .finally(() => setMencari(false));

    return () => kontrol.abort();
  }, [kodeAwal]);

  function cari(e) {
    e.preventDefault();
    const bersih = kode.trim().toUpperCase();
    if (!bersih) return;
    // Pencarian dijalankan lewat perubahan alamat supaya hasilnya bisa
    // dibagikan atau disimpan sebagai penanda halaman.
    setParamUrl({ kode: bersih });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-2xl font-bold text-ink-900">Lacak Pengajuan</h1>
      <p className="mt-1 text-sm text-slate-500">
        Masukkan kode peminjaman yang Anda terima saat mengajukan, contoh: PJM-20260908-K7M2QX.
      </p>

      <form onSubmit={cari} className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={kode}
            onChange={(e) => setKode(e.target.value)}
            placeholder="PJM-..."
            aria-label="Kode peminjaman"
            className="input pl-9 font-mono uppercase"
          />
        </div>
        <button
          type="submit"
          disabled={mencari || !kode.trim()}
          className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {mencari ? 'Mencari...' : 'Lacak'}
        </button>
      </form>

      <div className="mt-6">
        <PesanGalat pesan={galat} />
        {hasil && <KartuHasil data={hasil} />}
      </div>
    </div>
  );
}

function KartuHasil({ data }) {
  const Ikon = IKON_STATUS[data.status] || Clock;
  const sisa = sisaHari(data.tanggal_rencana_kembali);
  const terlambat = data.status === 'dipinjam' && sisa < 0;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-slate-400">{data.kode_peminjaman}</p>
          <h2 className="font-display text-lg font-bold text-ink-900">{data.alat?.nama_alat}</h2>
          <p className="text-sm text-slate-500">
            {data.jumlah} unit · atas nama {data.nama_peminjam}
          </p>
        </div>
        <span
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${STATUS_WARNA[data.status]}`}
        >
          <Ikon size={14} /> {STATUS_LABEL[data.status]}
        </span>
      </div>

      <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
        {PENJELASAN[data.status]}
      </p>

      {terlambat && (
        <p className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          Sudah lewat {Math.abs(sisa)} hari dari rencana kembali. Mohon segera dikembalikan ke lab.
        </p>
      )}

      <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <Baris label="Tanggal pinjam" nilai={tanggalSingkat(data.tanggal_pinjam)} />
        <Baris label="Rencana kembali" nilai={tanggalSingkat(data.tanggal_rencana_kembali)} />
        <Baris label="Diajukan pada" nilai={tanggalSingkat(data.dibuat_pada)} />
        <Baris
          label="Tanggal kembali"
          nilai={data.tanggal_kembali_aktual ? tanggalSingkat(data.tanggal_kembali_aktual) : 'Belum kembali'}
        />
      </dl>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-500">Keperluan</p>
        <p className="text-sm text-ink-900">{data.keperluan}</p>
      </div>

      {data.catatan_admin && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-medium text-slate-500">Catatan petugas lab</p>
          <p className="text-sm text-ink-900">{data.catatan_admin}</p>
        </div>
      )}
    </article>
  );
}

function Baris({ label, nilai }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-medium text-ink-900">{nilai}</dd>
    </div>
  );
}
