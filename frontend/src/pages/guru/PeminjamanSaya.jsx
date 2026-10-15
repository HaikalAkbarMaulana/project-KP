import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PackageSearch, X } from 'lucide-react';

import { api } from '../../lib/api';
import { useAmbilData } from '../../hooks/useAmbilData';
import { STATUS_LABEL, STATUS_WARNA, tanggalSingkat, sisaHari } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { Memuat, PesanGalat, PesanSukses, Kosong } from '../../components/Keadaan';

const SARINGAN = [
  { nilai: '', label: 'Semua' },
  { nilai: 'pending', label: 'Menunggu' },
  { nilai: 'disetujui', label: 'Disetujui' },
  { nilai: 'dipinjam', label: 'Sedang Dipinjam' },
  { nilai: 'dikembalikan', label: 'Sudah Kembali' },
];

/** Riwayat peminjaman milik guru yang sedang masuk. */
export default function PeminjamanSaya() {
  const { pengguna } = useAuth();
  const [status, setStatus] = useState('');
  const [pesan, setPesan] = useState('');
  const [galatAksi, setGalatAksi] = useState('');

  const { data, memuat, galat, muatUlang } = useAmbilData(
    `/peminjaman/saya${status ? `?status=${status}` : ''}`
  );
  const daftar = data?.data ?? [];

  async function batalkan(item) {
    setGalatAksi('');
    setPesan('');
    try {
      const res = await api.post(`/peminjaman/saya/${item.id}/batal`);
      setPesan(res.pesan);
      muatUlang();
    } catch (err) {
      setGalatAksi(err.message);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-900">Peminjaman Saya</h1>
        <p className="mt-1 text-sm text-slate-500">
          Riwayat pengajuan atas nama {pengguna?.nama}.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SARINGAN.map((s) => (
          <button
            key={s.nilai}
            type="button"
            onClick={() => setStatus(s.nilai)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
              status === s.nilai
                ? 'bg-ink-900 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:border-brand-200'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <PesanSukses pesan={pesan} />
      <PesanGalat pesan={galatAksi} />
      <PesanGalat pesan={galat} onCobaLagi={muatUlang} />

      {galat ? null : memuat && !data ? (
        <Memuat />
      ) : daftar.length === 0 ? (
        <Kosong
          judul="Belum ada pengajuan"
          keterangan="Pengajuan yang Anda kirim dari katalog alat akan muncul di sini."
        />
      ) : (
        <div className="grid gap-3">
          {daftar.map((item) => (
            <KartuPengajuan key={item.id} item={item} onBatal={() => batalkan(item)} />
          ))}
        </div>
      )}

      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:underline"
      >
        <PackageSearch size={16} /> Lihat katalog alat
      </Link>
    </div>
  );
}

function KartuPengajuan({ item, onBatal }) {
  const sisa = sisaHari(item.tanggal_rencana_kembali);
  const terlambat = item.status === 'dipinjam' && sisa < 0;

  return (
    <article
      className={`rounded-2xl border p-4 shadow-sm ${
        terlambat ? 'border-rose-200 bg-rose-50/60' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="break-all font-mono text-xs text-slate-500">{item.kode_peminjaman}</p>
        <span
          className={`inline-block shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${STATUS_WARNA[item.status]}`}
        >
          {STATUS_LABEL[item.status]}
        </span>
      </div>

      <p className="mt-2 break-words font-medium text-ink-900">
        {item.alat?.nama_alat}
        <span className="font-semibold"> · {item.jumlah} unit</span>
      </p>
      {item.keperluan && <p className="break-words text-xs text-slate-400">{item.keperluan}</p>}

      <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-sm">
        <div className="flex gap-3">
          <dt className="w-16 shrink-0 text-xs uppercase tracking-wide text-slate-400">Jadwal</dt>
          <dd className="min-w-0 flex-1 text-slate-600">
            <p>{tanggalSingkat(item.tanggal_pinjam)} → {tanggalSingkat(item.tanggal_rencana_kembali)}</p>
            {terlambat && (
              <p className="text-xs font-semibold text-rose-600">
                Telat {Math.abs(sisa)} hari — segera kembalikan ke lab.
              </p>
            )}
            {item.tanggal_kembali_aktual && (
              <p className="text-xs text-slate-400">
                Kembali {tanggalSingkat(item.tanggal_kembali_aktual)}
              </p>
            )}
          </dd>
        </div>

        {item.catatan_admin && (
          <div className="flex gap-3">
            <dt className="w-16 shrink-0 text-xs uppercase tracking-wide text-slate-400">Catatan</dt>
            <dd className="min-w-0 flex-1 break-words text-xs text-slate-500">{item.catatan_admin}</dd>
          </div>
        )}
      </dl>

      {/* Pembatalan sendiri hanya selama belum ditinjau. Setelah disetujui,
          stoknya sudah ditahan dan alatnya mungkin sudah disiapkan petugas,
          jadi pembatalannya harus lewat mereka. */}
      {item.status === 'pending' && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onBatal}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-600"
          >
            <X size={15} /> Batalkan pengajuan
          </button>
        </div>
      )}
    </article>
  );
}
