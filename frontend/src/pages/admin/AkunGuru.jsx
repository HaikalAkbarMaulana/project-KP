import { useState } from 'react';
import {
  Plus, Search, X, Upload, Download, KeyRound, Trash2, UserCheck, UserX, FileSpreadsheet,
} from 'lucide-react';

import { api } from '../../lib/api';
import { useAmbilData } from '../../hooks/useAmbilData';
import { useTundaNilai } from '../../hooks/useTundaNilai';
import { KOLOM, bacaBarisGuru, buatTemplat, PESAN_NIP_RUSAK } from '../../lib/excelGuru';
import Modal from '../../components/Modal';
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

      <DialogImpor
        terbuka={imporTerbuka}
        onTutup={() => setImporTerbuka(false)}
        onSelesai={muatUlang}
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

function DialogImpor({ terbuka, onTutup, onSelesai }) {
  const [baris, setBaris] = useState(null);
  const [namaBerkas, setNamaBerkas] = useState('');
  const [hasil, setHasil] = useState(null);
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);

  const adaNipRusak = !!baris?.some((r) => r._nipRusak);

  function tutup() {
    setBaris(null);
    setNamaBerkas('');
    setHasil(null);
    setGalat('');
    onTutup();
  }

  /**
   * SheetJS diimpor saat dibutuhkan saja.
   *
   * Pustakanya cukup besar, sementara impor Excel hanya dipakai sesekali
   * di awal tahun ajaran. Memuatnya di sini membuat halaman admin lain
   * tidak ikut menanggung ukurannya.
   */
  async function bacaBerkas(berkas) {
    setGalat('');
    setHasil(null);
    setBaris(null);
    setNamaBerkas(berkas.name);

    try {
      const XLSX = await import('xlsx');
      const buf = await berkas.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const lembar = wb.Sheets[wb.SheetNames[0]];
      if (!lembar) throw new Error('Berkas tidak punya lembar kerja.');

      // defval: '' supaya sel kosong tetap muncul sebagai kolom, bukan
      // menghilang — tanpa itu baris yang mapel-nya kosong akan tergeser.
      // raw:true dipertahankan supaya sel bertipe angka tetap terbaca
      // sebagai angka — itulah tanda NIP yang sudah dirusak Excel. Dengan
      // raw:false ia justru menyamar jadi teks "1.98005E+17".
      const mentah = XLSX.utils.sheet_to_json(lembar, { defval: '', raw: true });
      const terbaca = bacaBarisGuru(mentah);

      if (terbaca.length === 0) {
        throw new Error(
          'Tidak ada baris berisi Nama atau NIP. Pastikan judul kolomnya persis: ' +
          KOLOM.join(', ') + '.'
        );
      }
      setBaris(terbaca);
    } catch (err) {
      setGalat(`Gagal membaca berkas: ${err.message}`);
    }
  }

  async function kirim() {
    setSibuk(true);
    setGalat('');
    try {
      // Tiap akun dibuat satu per satu di Supabase, jadi 150 baris bisa
      // memakan lebih dari satu menit — jauh di atas batas bawaan 30 detik.
      // Penanda _nipRusak hanya untuk layar; server tidak perlu tahu.
      const bersih = baris.map(({ nama, nip, mapel, no_hp }) => ({ nama, nip, mapel, no_hp }));
      const res = await api.post('/admin/guru/impor', { baris: bersih }, { batasWaktuMs: 300_000 });
      setHasil(res.data);
      onSelesai();
    } catch (err) {
      setGalat(err.message);
    } finally {
      setSibuk(false);
    }
  }

  async function unduhTemplat() {
    const XLSX = await import('xlsx');
    XLSX.writeFile(buatTemplat(XLSX), 'templat-akun-guru.xlsx');
  }

  return (
    <Modal terbuka={terbuka} judul="Impor Akun Guru dari Excel" onTutup={tutup} lebar="max-w-2xl">
      <div className="space-y-4">
        {!hasil && (
          <>
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-medium text-ink-900">Susunan kolomnya:</p>
              <p className="mt-1">
                <span className="font-mono text-xs">Nama</span> dan{' '}
                <span className="font-mono text-xs">NIP</span> wajib diisi.{' '}
                <span className="font-mono text-xs">Mapel</span> dan{' '}
                <span className="font-mono text-xs">No HP</span> boleh dikosongkan.
              </p>
              <button
                type="button"
                onClick={unduhTemplat}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
              >
                <Download size={15} /> Unduh templat Excel
              </button>
            </div>

            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-8 text-center hover:border-brand-300 hover:bg-brand-50/40">
              <FileSpreadsheet size={28} className="text-slate-400" />
              <span className="text-sm font-medium text-slate-600">
                {namaBerkas || 'Pilih berkas Excel (.xlsx atau .xls)'}
              </span>
              <span className="text-xs text-slate-400">Maksimal 150 baris sekali unggah</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const berkas = e.target.files?.[0];
                  if (berkas) bacaBerkas(berkas);
                  // Dikosongkan agar memilih berkas yang sama dua kali tetap
                  // memicu pembacaan ulang.
                  e.target.value = '';
                }}
              />
            </label>

            <PesanGalat pesan={galat} />

            {baris && (
              <>
                {/* NIP yang terbaca sebagai angka sudah rusak di dalam Excel
                    dan tidak bisa dipulihkan dari sini. Impornya ditahan
                    seluruhnya: membuat akun dengan NIP yang meleset satu
                    digit jauh lebih merepotkan daripada mengulang unggah,
                    karena gurunya tidak akan pernah bisa masuk dan tidak
                    ada yang tahu sebabnya. */}
                {baris.some((r) => r._nipRusak) && (
                  <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200">
                    <p className="font-semibold">
                      {baris.filter((r) => r._nipRusak).length} baris punya NIP yang tidak utuh.
                    </p>
                    <p className="mt-1">{PESAN_NIP_RUSAK}</p>
                    <p className="mt-2 text-xs">
                      Baris di Excel:{' '}
                      {baris
                        .map((r, i) => (r._nipRusak ? i + 2 : null))
                        .filter(Boolean)
                        .join(', ')}
                      . Cara tercepat: pakai templat dari tombol di atas — kolom NIP-nya
                      sudah berformat Teks.
                    </p>
                  </div>
                )}

                <p className="text-sm text-slate-600">
                  <span className="font-semibold text-ink-900">{baris.length} baris</span> terbaca
                  dari berkas. Periksa sekilas, lalu lanjutkan.
                </p>
                <div className="max-h-48 overflow-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        {KOLOM.map((k) => <th key={k} className="px-3 py-2">{k}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {baris.slice(0, 10).map((r, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5">{r.nama}</td>
                          <td className="px-3 py-1.5 font-mono text-xs">{r.nip}</td>
                          <td className="px-3 py-1.5 text-slate-500">{r.mapel || '—'}</td>
                          <td className="px-3 py-1.5 text-slate-500">{r.no_hp || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {baris.length > 10 && (
                  <p className="text-xs text-slate-400">
                    Menampilkan 10 baris pertama dari {baris.length}.
                  </p>
                )}
              </>
            )}
          </>
        )}

        {hasil && <LaporanImpor hasil={hasil} />}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button" onClick={tutup}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {hasil ? 'Tutup' : 'Batal'}
          </button>
          {!hasil && (
            <button
              type="button"
              onClick={kirim}
              disabled={!baris || sibuk || adaNipRusak}
              className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {sibuk ? 'Membuat akun...' : `Buat ${baris?.length ?? 0} akun`}
            </button>
          )}
        </div>

        {sibuk && (
          <p className="text-xs text-slate-500">
            Akun dibuat satu per satu, jadi berkas yang panjang butuh waktu. Jangan tutup
            jendela ini dulu.
          </p>
        )}
      </div>
    </Modal>
  );
}

function LaporanImpor({ hasil }) {
  const { ringkasan, baris } = hasil;
  const bermasalah = baris.filter((b) => b.status !== 'berhasil');

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Angka label="Dibuat" nilai={ringkasan.dibuat} kelas="bg-brand-50 text-brand-700" />
        <Angka label="Dilewati" nilai={ringkasan.dilewati} kelas="bg-amber-50 text-amber-700" />
        <Angka label="Gagal" nilai={ringkasan.gagal} kelas="bg-rose-50 text-rose-700" />
      </div>

      {bermasalah.length === 0 ? (
        <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-800">
          Semua baris berhasil. Beri tahu guru-gurunya: masuk memakai NIP, kata sandinya
          NIP juga, lalu aplikasi akan meminta menggantinya.
        </p>
      ) : (
        <>
          <p className="text-sm font-medium text-ink-900">
            Baris yang perlu diperiksa ({bermasalah.length}):
          </p>
          <div className="max-h-56 overflow-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Baris</th>
                  <th className="px-3 py-2">Nama</th>
                  <th className="px-3 py-2">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bermasalah.map((b) => (
                  <tr key={b.nomor} className={b.status === 'gagal' ? 'bg-rose-50/40' : ''}>
                    <td className="px-3 py-1.5 font-mono text-xs">{b.nomor}</td>
                    <td className="px-3 py-1.5">{b.nama || <span className="text-slate-400">—</span>}</td>
                    <td className="px-3 py-1.5 text-slate-600">{b.pesan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">
            Nomor baris mengikuti nomor di Excel. Betulkan baris itu saja lalu unggah
            ulang berkasnya — yang sudah terdaftar akan dilewati, tidak dobel.
          </p>
        </>
      )}
    </div>
  );
}

function Angka({ label, nilai, kelas }) {
  return (
    <div className={`rounded-xl px-3 py-2 ${kelas}`}>
      <p className="font-display text-xl font-bold">{nilai}</p>
      <p className="text-xs font-medium">{label}</p>
    </div>
  );
}
