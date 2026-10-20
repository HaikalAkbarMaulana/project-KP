import { useState } from 'react';
import {
  Plus, Search, X, Upload, KeyRound, Trash2, UserCheck, UserX,
} from 'lucide-react';

import { api } from '../../lib/api';
import { useAmbilData } from '../../hooks/useAmbilData';
import { useTundaNilai } from '../../hooks/useTundaNilai';
import { KOLOM, bacaBarisGuru, buatTemplat, PESAN_NIP_RUSAK } from '../../lib/excelGuru';
import Modal from '../../components/Modal';
import DialogImporExcel from '../../components/DialogImporExcel';
import KonfirmasiHapus from '../../components/KonfirmasiHapus';
import { Memuat, PesanGalat, PesanSukses, Kosong } from '../../components/Keadaan';

export default function AkunGuru() {
  const [pencarian, setPencarian] = useState('');
  const [formTerbuka, setFormTerbuka] = useState(false);
  const [imporTerbuka, setImporTerbuka] = useState(false);
  const [akanDihapus, setAkanDihapus] = useState(null);
  const [pesan, setPesan] = useState('');
  const [galatAksi, setGalatAksi] = useState('');

  const kataKunci = useTundaNilai(pencarian);
  const { data, memuat, galat, muatUlang } = useAmbilData(
    `/admin/guru${kataKunci ? `?q=${encodeURIComponent(kataKunci)}` : ''}`
  );
  const daftar = data?.data ?? [];

  async function jalankan(aksi, pesanSukses) {
    setGalatAksi('');
    setPesan('');
    try {
      const res = await aksi();
      setPesan(res?.pesan || pesanSukses);
      muatUlang();
    } catch (err) {
      setGalatAksi(err.message);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Akun Guru</h1>
          <p className="mt-1 text-sm text-slate-500">
            {daftar.length} guru terdaftar. Guru masuk memakai NIP; kata sandi awalnya
            NIP sendiri dan wajib diganti saat pertama masuk.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setImporTerbuka(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:border-brand-200 hover:text-brand-700"
          >
            <Upload size={16} /> Impor Excel
          </button>
          <button
            type="button"
            onClick={() => setFormTerbuka(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
          >
            <Plus size={16} /> Tambah Guru
          </button>
        </div>
      </div>

      <div className="relative sm:max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={pencarian}
          onChange={(e) => setPencarian(e.target.value)}
          placeholder="Cari nama, NIP, atau mapel..."
          className="input pl-9 pr-9"
        />
        {pencarian && (
          <button
            type="button"
            onClick={() => setPencarian('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-slate-100"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <PesanSukses pesan={pesan} />
      <PesanGalat pesan={galatAksi} />
      <PesanGalat pesan={galat} onCobaLagi={muatUlang} />

      {galat ? null : memuat && !data ? (
        <Memuat />
      ) : daftar.length === 0 ? (
        <Kosong
          judul={kataKunci ? 'Tidak ada guru yang cocok' : 'Belum ada akun guru'}
          keterangan={
            kataKunci
              ? 'Coba kata kunci lain.'
              : 'Daftarkan guru satu per satu, atau sekaligus lewat berkas Excel.'
          }
        />
      ) : (
        <div className="grid gap-3">
          {daftar.map((g) => (
            <KartuGuru
              key={g.id}
              guru={g}
              onResetSandi={() =>
                jalankan(() => api.post(`/admin/guru/${g.id}/reset-sandi`), 'Kata sandi disetel ulang.')
              }
              onUbahAktif={() =>
                jalankan(
                  () => api.patch(`/admin/guru/${g.id}`, { aktif: !g.aktif }),
                  g.aktif ? 'Akun dinonaktifkan.' : 'Akun diaktifkan.'
                )
              }
              onHapus={() => setAkanDihapus(g)}
            />
          ))}
        </div>
      )}

      <FormGuru
        terbuka={formTerbuka}
        onTutup={() => setFormTerbuka(false)}
        onSimpan={(p) => {
          setFormTerbuka(false);
          setPesan(p);
          muatUlang();
        }}
      />

      <DialogImporExcel
        terbuka={imporTerbuka}
        onTutup={() => setImporTerbuka(false)}
        onSelesai={muatUlang}
        judul="Impor Akun Guru dari Excel"
        kolom={KOLOM}
        kolomWajib={['Nama', 'NIP']}
        namaTemplat="templat-akun-guru.xlsx"
        buatTemplat={buatTemplat}
        bacaBaris={bacaBarisGuru}
        maksBaris={150}
        kolomPratinjau={[
          { kunci: 'nama', label: 'Nama' },
          { kunci: 'nip', label: 'NIP' },
          { kunci: 'mapel', label: 'Mapel' },
          { kunci: 'no_hp', label: 'No HP' },
        ]}
        kirim={(b) =>
          api.post(
            '/admin/guru/impor',
            // Penanda _nipRusak hanya untuk layar; server tidak perlu tahu.
            { baris: b.map(({ nama, nip, mapel, no_hp }) => ({ nama, nip, mapel, no_hp })) },
            { batasWaktuMs: 300_000 }
          )
        }
        penghalang={(b) => {
          const rusak = b.map((r, i) => (r._nipRusak ? i + 2 : null)).filter(Boolean);
          return rusak.length
            ? {
                judul: `${rusak.length} baris punya NIP yang tidak utuh.`,
                pesan: PESAN_NIP_RUSAK,
                nomorBaris: rusak,
              }
            : null;
        }}
      />

      <KonfirmasiHapus
        terbuka={!!akanDihapus}
        judul="Hapus akun guru"
        keterangan={
          akanDihapus
            ? `Akun ${akanDihapus.nama} (NIP ${akanDihapus.nip}) akan dihapus dan tidak bisa ` +
              'dipakai masuk lagi. Riwayat peminjamannya tetap tersimpan beserta nama dan NIP-nya. ' +
              'Kalau hanya ingin mencabut akses sementara, pakai tombol nonaktifkan.'
            : ''
        }
        onTutup={() => setAkanDihapus(null)}
        onKonfirmasi={async () => {
          await api.delete(`/admin/guru/${akanDihapus.id}`);
          setPesan(`Akun ${akanDihapus.nama} dihapus.`);
          muatUlang();
        }}
      />
    </div>
  );
}

function KartuGuru({ guru, onResetSandi, onUbahAktif, onHapus }) {
  return (
    <article
      className={`rounded-2xl border p-4 shadow-sm ${
        guru.aktif ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words font-medium text-ink-900">
            {guru.nama}
            {!guru.aktif && (
              <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
                Nonaktif
              </span>
            )}
            {guru.harus_ganti_sandi && (
              <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                Belum ganti sandi
              </span>
            )}
          </p>
          <p className="break-all font-mono text-xs text-slate-500">NIP {guru.nip}</p>
          <p className="break-words text-xs text-slate-400">
            {[guru.mapel, guru.no_hp].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={onResetSandi}
            title="Kembalikan kata sandi ke NIP"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <KeyRound size={15} /> Reset sandi
          </button>
          <button
            type="button"
            onClick={onUbahAktif}
            title={guru.aktif ? 'Nonaktifkan akun' : 'Aktifkan akun'}
            className="rounded-lg p-3 text-slate-400 hover:bg-slate-100 hover:text-brand-700"
          >
            {guru.aktif ? <UserX size={16} /> : <UserCheck size={16} />}
            <span className="sr-only">{guru.aktif ? 'Nonaktifkan' : 'Aktifkan'}</span>
          </button>
          <button
            type="button"
            onClick={onHapus}
            title="Hapus akun"
            className="rounded-lg p-3 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash2 size={16} />
            <span className="sr-only">Hapus akun</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function FormGuru({ terbuka, onTutup, onSimpan }) {
  const [form, setForm] = useState({ nama: '', nip: '', mapel: '', no_hp: '' });
  const [galat, setGalat] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);

  function ubah(kunci) {
    return (e) => setForm((f) => ({ ...f, [kunci]: e.target.value }));
  }

  async function kirim(e) {
    e.preventDefault();
    setGalat('');
    setMenyimpan(true);
    try {
      const res = await api.post('/admin/guru', form);
      setForm({ nama: '', nip: '', mapel: '', no_hp: '' });
      onSimpan(res.pesan);
    } catch (err) {
      setGalat(err.message);
    } finally {
      setMenyimpan(false);
    }
  }

  return (
    <Modal terbuka={terbuka} judul="Tambah Akun Guru" onTutup={onTutup}>
      <form onSubmit={kirim} className="space-y-4">
        <PesanGalat pesan={galat} />

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Nama lengkap *</span>
          <input required maxLength={120} value={form.nama} onChange={ubah('nama')} className="input" />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">NIP / NUPTK *</span>
          <input
            required maxLength={30} value={form.nip} onChange={ubah('nip')}
            className="input" placeholder="198005202007012005"
          />
          <span className="mt-1 block text-xs text-slate-400">
            Dipakai sebagai nama pengguna sekaligus kata sandi awal, jadi tidak bisa diubah
            setelah akun dibuat. Guru tanpa NIP resmi: isi NUPTK atau nomor dari sekolah.
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Mata pelajaran</span>
            <input
              maxLength={80} value={form.mapel} onChange={ubah('mapel')}
              className="input" placeholder="Opsional"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Nomor HP</span>
            <input
              maxLength={20} value={form.no_hp} onChange={ubah('no_hp')}
              className="input" placeholder="Opsional"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button" onClick={onTutup}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            type="submit" disabled={menyimpan}
            className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {menyimpan ? 'Menyimpan...' : 'Daftarkan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
