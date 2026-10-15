import { useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { MapPin, Boxes, ArrowLeft, PackageSearch, Copy, Check, Info, LogIn } from 'lucide-react';

import { api } from '../../lib/api';
import { useAmbilData } from '../../hooks/useAmbilData';
import { tanggalHariIni } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { Memuat, PesanGalat } from '../../components/Keadaan';

// Nama dan NIP tidak lagi ada di sini: keduanya diambil dari akun yang
// sedang masuk, supaya satu guru tidak bisa mengajukan atas nama guru
// lain. Mapel dan nomor HP tetap bisa diubah karena kadang berbeda untuk
// peminjaman tertentu.
const FORM_KOSONG = {
  mapel: '',
  no_hp: '',
  jumlah: 1,
  keperluan: '',
  tanggal_pinjam: tanggalHariIni(),
  tanggal_rencana_kembali: '',
};

export default function DetailAlat() {
  const { id } = useParams();
  const { data, memuat, galat, muatUlang } = useAmbilData(`/alat/${id}`);
  const alat = data?.data;

  // Penanda memuat hanya menggantikan halaman saat memang belum ada apa-apa
  // untuk ditampilkan. Kalau menggantikannya pada setiap pemuatan ulang,
  // formulir ikut terbongkar berikut isinya — itulah yang dulu membuat kode
  // peminjaman lenyap begitu pengajuan terkirim.
  if (memuat && !alat) return <Memuat />;

  if (galat && !alat) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <PesanGalat pesan={galat} onCobaLagi={muatUlang} />
        <Link to="/" className="mt-4 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline">
          <ArrowLeft size={16} /> Kembali ke katalog
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <Link to="/" className="mb-6 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700">
        <ArrowLeft size={16} /> Kembali ke katalog alat
      </Link>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="flex h-56 items-center justify-center overflow-hidden rounded-2xl bg-brand-50">
            {alat.foto_url
              ? <img src={alat.foto_url} alt={alat.nama_alat} className="h-full w-full object-cover" />
              : <PackageSearch size={64} className="text-brand-400" />}
          </div>

          <h1 className="font-display mt-5 text-2xl font-bold text-ink-900">{alat.nama_alat}</h1>
          {alat.merk_tipe && <p className="text-sm text-slate-500">{alat.merk_tipe}</p>}

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
            <span className="flex items-center gap-1"><MapPin size={14} /> {alat.ruangan?.nama_ruangan || '-'}</span>
            <span className="flex items-center gap-1"><Boxes size={14} /> {alat.kategori?.nama_kategori || '-'}</span>
          </div>

          {alat.deskripsi && <p className="mt-4 text-sm leading-relaxed text-slate-600">{alat.deskripsi}</p>}

          <dl className="mt-5 grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
            <Rincian label="Kode alat" nilai={<span className="font-mono text-xs">{alat.kode_alat}</span>} />
            <Rincian label="Total unit" nilai={alat.jumlah_total} />
            <Rincian
              label="Bisa dipinjam"
              nilai={<span className="font-semibold text-brand-700">{alat.jumlah_tersedia}</span>}
            />
            <Rincian
              label="Rusak"
              nilai={<span className={alat.jumlah_rusak > 0 ? 'text-amber-600' : ''}>{alat.jumlah_rusak}</span>}
            />
          </dl>
        </div>

        <div className="lg:col-span-3">
          <FormPengajuan alat={alat} />
        </div>
      </div>
    </div>
  );
}

function Rincian({ label, nilai }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-medium text-ink-900">{nilai}</dd>
    </div>
  );
}

function FormPengajuan({ alat }) {
  const { pengguna, adalahGuru, memuat: memuatSesi } = useAuth();
  const lokasi = useLocation();

  const [form, setForm] = useState(() => ({
    ...FORM_KOSONG,
    mapel: pengguna?.mapel ?? '',
    no_hp: pengguna?.no_hp ?? '',
  }));
  const [galat, setGalat] = useState('');
  const [mengirim, setMengirim] = useState(false);
  const [kodeBerhasil, setKodeBerhasil] = useState('');

  const bisaDipinjam = alat.boleh_dipinjam && alat.jumlah_tersedia > 0;

  if (memuatSesi) return null;

  // Pengajuan sekarang menuntut akun guru. Petugas lab yang membuka
  // halaman ini diarahkan ke menu Catat Peminjaman, bukan disuruh keluar
  // lalu masuk lagi sebagai guru.
  if (!adalahGuru) {
    return (
      <AjakanMasuk
        pengguna={pengguna}
        tujuan={lokasi.pathname}
      />
    );
  }

  function ubah(kunci) {
    return (e) => setForm((f) => ({ ...f, [kunci]: e.target.value }));
  }

  async function kirim(e) {
    e.preventDefault();
    setGalat('');
    setMengirim(true);

    try {
      const res = await api.post('/peminjaman', {
        ...form,
        alat_id: alat.id,
        jumlah: Number(form.jumlah),
      });
      setKodeBerhasil(res.data.kode_peminjaman);
      // Mapel dan nomor HP dibiarkan terisi: keduanya milik orang yang
      // sama, dan mengosongkannya hanya menyusahkan saat mengajukan lagi.
      setForm((f) => ({ ...FORM_KOSONG, mapel: f.mapel, no_hp: f.no_hp }));
      // Data alat sengaja tidak dimuat ulang di sini: pengajuan yang baru
      // masuk belum menahan stok sama sekali — stok baru berkurang ketika
      // petugas lab menyetujuinya. Jadi angkanya memang tidak berubah.
    } catch (err) {
      setGalat(err.message);
    } finally {
      setMengirim(false);
    }
  }

  if (kodeBerhasil) {
    return <PengajuanTerkirim kode={kodeBerhasil} onAjukanLagi={() => setKodeBerhasil('')} />;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="font-display text-lg font-bold text-ink-900">Ajukan Peminjaman</h2>
      <p className="mt-1 text-sm text-slate-500">
        Mengajukan sebagai <span className="font-medium text-ink-900">{pengguna.nama}</span>
        {pengguna.nip ? ` (NIP ${pengguna.nip})` : ''}. Statusnya bisa dipantau di
        halaman Peminjaman Saya.
      </p>

      {!alat.boleh_dipinjam && (
        <p className="mt-4 flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Info size={16} className="mt-px shrink-0" />
          Alat ini tidak dipinjamkan keluar lab. Silakan hubungi petugas lab bila tetap diperlukan.
        </p>
      )}

      {alat.boleh_dipinjam && alat.jumlah_tersedia === 0 && (
        <p className="mt-4 flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Info size={16} className="mt-px shrink-0" />
          Semua unit sedang dipinjam. Coba lagi setelah ada yang dikembalikan.
        </p>
      )}

      <form onSubmit={kirim} className="mt-5 space-y-4">
        <PesanGalat pesan={galat} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Isian label="Mata pelajaran">
            <input
              maxLength={80} value={form.mapel}
              onChange={ubah('mapel')} className="input" placeholder="Contoh: IPA"
            />
          </Isian>
          <Isian label="Nomor HP aktif" wajib>
            <input
              required type="tel" inputMode="tel" maxLength={20} value={form.no_hp}
              onChange={ubah('no_hp')} className="input" placeholder="08xxxxxxxxxx"
            />
          </Isian>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Isian label="Jumlah" wajib>
            <input
              required type="number" min={1} max={Math.max(alat.jumlah_tersedia, 1)}
              value={form.jumlah} onChange={ubah('jumlah')} className="input"
            />
          </Isian>
          <Isian label="Tanggal pinjam" wajib>
            <input
              required type="date" min={tanggalHariIni()} value={form.tanggal_pinjam}
              onChange={ubah('tanggal_pinjam')} className="input"
            />
          </Isian>
          <Isian label="Rencana kembali" wajib>
            <input
              required type="date" min={form.tanggal_pinjam || tanggalHariIni()}
              value={form.tanggal_rencana_kembali}
              onChange={ubah('tanggal_rencana_kembali')} className="input"
            />
          </Isian>
        </div>

        <Isian label="Keperluan" wajib>
          <textarea
            required rows={3} maxLength={500} value={form.keperluan}
            onChange={ubah('keperluan')} className="input"
            placeholder="Contoh: Praktikum kelas VIII A, materi rangkaian listrik"
          />
        </Isian>

        <button
          type="submit"
          disabled={mengirim || !bisaDipinjam}
          className="w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mengirim ? 'Mengirim...' : 'Kirim Pengajuan'}
        </button>

        <p className="text-center text-xs text-slate-400">
          Data yang Anda isi hanya dipakai petugas lab untuk memproses peminjaman ini.
        </p>
      </form>
    </div>
  );
}

/**
 * Ditampilkan menggantikan formulir ketika yang membuka belum masuk, atau
 * masuk sebagai petugas lab.
 */
function AjakanMasuk({ pengguna, tujuan }) {
  const petugas = pengguna?.peran === 'admin';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="font-display text-lg font-bold text-ink-900">Ajukan Peminjaman</h2>

      {petugas ? (
        <>
          <p className="mt-1 text-sm text-slate-500">
            Anda masuk sebagai petugas lab. Peminjaman atas nama guru dicatat
            lewat panel admin, termasuk untuk guru yang belum punya akun.
          </p>
          <Link
            to="/admin/peminjaman"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
          >
            Buka Catat Peminjaman
          </Link>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-slate-500">
            Peminjaman kini lewat akun guru, supaya setiap pinjaman jelas
            penanggung jawabnya. Masuk dengan NIP Anda untuk mengajukan.
          </p>
          <Link
            to="/masuk"
            state={{ tujuan }}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
          >
            <LogIn size={16} /> Masuk untuk mengajukan
          </Link>
          <p className="mt-3 text-xs text-slate-400">
            Belum punya akun? Hubungi petugas lab untuk didaftarkan.
          </p>
        </>
      )}
    </div>
  );
}

function PengajuanTerkirim({ kode, onAjukanLagi }) {
  const [tersalin, setTersalin] = useState(false);

  async function salin() {
    try {
      await navigator.clipboard.writeText(kode);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 2000);
    } catch {
      // Beberapa browser menolak akses papan klip tanpa HTTPS. Kodenya
      // tetap terlihat besar di layar sehingga masih bisa dicatat manual.
      setTersalin(false);
    }
  }

  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50 p-6 text-center">
      <h2 className="font-display text-lg font-bold text-brand-900">Pengajuan terkirim</h2>
      <p className="mt-1 text-sm text-brand-800">
        Catat kode di bawah ini. Petugas lab akan meninjau pengajuan Anda.
      </p>

      <div className="mx-auto mt-5 flex max-w-xs items-center justify-between gap-3 rounded-xl border border-brand-300 bg-white px-4 py-3">
        <code className="font-mono text-lg font-bold tracking-wide text-ink-900">{kode}</code>
        <button
          type="button"
          onClick={salin}
          aria-label="Salin kode peminjaman"
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-brand-700"
        >
          {tersalin ? <Check size={16} className="text-brand-600" /> : <Copy size={16} />}
        </button>
      </div>

      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        <Link
          to={`/lacak?kode=${encodeURIComponent(kode)}`}
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Lacak status pengajuan
        </Link>
        <button
          type="button"
          onClick={onAjukanLagi}
          className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 ring-1 ring-brand-300 hover:bg-brand-100"
        >
          Ajukan alat ini lagi
        </button>
      </div>
    </div>
  );
}

function Isian({ label, wajib, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">
        {label} {wajib && <span className="text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}
