import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Beaker, MapPin, Boxes, PackageSearch, Wrench } from 'lucide-react';

import { useAmbilData } from '../../hooks/useAmbilData';
import { useTundaNilai } from '../../hooks/useTundaNilai';
import { keQuery } from '../../lib/api';
import { angka } from '../../lib/format';
import { Memuat, PesanGalat, Kosong } from '../../components/Keadaan';
import LogoSekolah from '../../components/LogoSekolah';

const PER_HALAMAN = 24;

export default function Beranda() {
  const [pencarian, setPencarian] = useState('');
  const [kategoriDipilih, setKategoriDipilih] = useState('');
  const [ruanganDipilih, setRuanganDipilih] = useState('');
  const [ketersediaan, setKetersediaan] = useState('');
  const [halaman, setHalaman] = useState(1);

  const kataKunci = useTundaNilai(pencarian);

  const kategori = useAmbilData('/kategori');
  const ruangan = useAmbilData('/ruangan');

  // Path dijadikan satu string yang stabil supaya efek pengambilan data
  // tidak berjalan ulang tanpa alasan.
  const pathAlat = useMemo(
    () => `/alat${keQuery({
      q: kataKunci,
      kategori_id: kategoriDipilih,
      ruangan_id: ruanganDipilih,
      ketersediaan,
      halaman,
      per_halaman: PER_HALAMAN,
    })}`,
    [kataKunci, kategoriDipilih, ruanganDipilih, ketersediaan, halaman]
  );

  const { data, memuat, galat, muatUlang } = useAmbilData(pathAlat);
  const daftarAlat = data?.data ?? [];
  const total = data?.halaman?.total ?? 0;
  const jumlahRuangan = ruangan.data?.data?.length ?? 0;
  const jumlahKategori = kategori.data?.data?.length ?? 0;
  const totalHalaman = Math.max(Math.ceil(total / PER_HALAMAN), 1);

  /** Setiap perubahan filter mengembalikan tampilan ke halaman pertama. */
  function ubahFilter(pengatur) {
    return (e) => {
      pengatur(e.target.value);
      setHalaman(1);
    };
  }

  return (
    <div>
      <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900 py-12 text-white sm:py-16">
        {/* Semburat warna lembut agar latar gelapnya tidak terasa rata. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl"
        />

        <div className="relative mx-auto flex max-w-6xl items-center gap-10 px-6">
          <div className="min-w-0 flex-1">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-brand-200 ring-1 ring-white/10">
              <Beaker size={14} /> Lab Komputer &amp; IPA
            </p>
            <h1 className="font-display max-w-xl text-2xl font-bold leading-tight sm:text-4xl">
              Cek ketersediaan alat lab, lalu ajukan peminjaman
            </h1>
            <p className="mt-3 max-w-lg text-sm text-slate-300 sm:text-base">
              Bapak/Ibu guru bisa langsung mengajukan peminjaman dari halaman ini —
              tanpa perlu membuat akun. Petugas lab yang akan meninjau pengajuannya.
            </p>

            {/* Ringkasan isi katalog. Baru ditampilkan setelah datanya tiba
                agar tidak sempat terbaca "0 jenis alat" saat masih memuat. */}
            {total > 0 && (
              <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
                <Ringkasan angkaTampil={angka(total)} label="jenis alat" />
                <Ringkasan angkaTampil={angka(jumlahRuangan)} label="ruangan" />
                <Ringkasan angkaTampil={angka(jumlahKategori)} label="kategori" />
              </dl>
            )}
          </div>

          {/* Disembunyikan di layar sempit: di sana ruangnya lebih berguna
              untuk tulisan, dan lambangnya sudah tampil di header. */}
          <LogoSekolah ukuran={176} kelas="hidden h-36 w-36 drop-shadow-2xl lg:block xl:h-44 xl:w-44" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={pencarian}
              onChange={(e) => { setPencarian(e.target.value); setHalaman(1); }}
              placeholder="Cari alat, misal: mikroskop"
              aria-label="Cari alat"
              className="input pl-9"
            />
          </div>

          <select
            value={kategoriDipilih}
            onChange={ubahFilter(setKategoriDipilih)}
            aria-label="Saring menurut kategori"
            className="input"
          >
            <option value="">Semua kategori</option>
            {(kategori.data?.data ?? []).map((k) => (
              <option key={k.id} value={k.id}>{k.nama_kategori}</option>
            ))}
          </select>

          <select
            value={ruanganDipilih}
            onChange={ubahFilter(setRuanganDipilih)}
            aria-label="Saring menurut ruangan"
            className="input"
          >
            <option value="">Semua ruangan</option>
            {(ruangan.data?.data ?? []).map((r) => (
              <option key={r.id} value={r.id}>{r.nama_ruangan}</option>
            ))}
          </select>

          <select
            value={ketersediaan}
            onChange={ubahFilter(setKetersediaan)}
            aria-label="Saring menurut ketersediaan"
            className="input"
          >
            <option value="">Semua ketersediaan</option>
            <option value="tersedia">Tersedia sekarang</option>
            <option value="habis">Sedang tidak tersedia</option>
          </select>
        </div>

        <PesanGalat pesan={galat} onCobaLagi={muatUlang} />

        {galat ? null : memuat ? (
          <Memuat pesan="Memuat katalog alat..." />
        ) : daftarAlat.length === 0 ? (
          <Kosong
            judul="Tidak ada alat yang cocok"
            keterangan="Coba ubah kata kunci atau kosongkan penyaringnya."
          />
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-500">
              Menampilkan {daftarAlat.length} dari {angka(total)} jenis alat
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {daftarAlat.map((alat) => <KartuAlat key={alat.id} alat={alat} />)}
            </div>

            {totalHalaman > 1 && (
              <Penomoran
                halaman={halaman}
                totalHalaman={totalHalaman}
                onPindah={(nomor) => {
                  setHalaman(nomor);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}

/** Satu angka ringkasan di bagian sambutan. */
function Ringkasan({ angkaTampil, label }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd>
        <span className="font-display text-2xl font-bold text-white">{angkaTampil}</span>
        <span className="ml-1.5 text-sm text-slate-400">{label}</span>
      </dd>
    </div>
  );
}

function KartuAlat({ alat }) {
  const tersedia = alat.jumlah_tersedia > 0 && alat.boleh_dipinjam;

  return (
    <Link
      to={`/alat/${alat.id}`}
      className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg hover:shadow-brand-900/5 focus-visible:-translate-y-1"
    >
      <div className="mb-4 flex h-32 items-center justify-center overflow-hidden rounded-xl bg-brand-50">
        {alat.foto_url ? (
          <img
            src={alat.foto_url}
            alt={alat.nama_alat}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <PackageSearch
            size={36}
            className="text-brand-400 transition-transform duration-300 group-hover:scale-110"
          />
        )}
      </div>

      <h3 className="font-display font-semibold text-ink-900 group-hover:text-brand-700">
        {alat.nama_alat}
      </h3>
      {alat.merk_tipe && <p className="text-xs text-slate-400">{alat.merk_tipe}</p>}

      <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
        <MapPin size={12} /> {alat.ruangan?.nama_ruangan || 'Belum ditentukan'}
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-1">
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <Boxes size={12} /> {alat.kategori?.nama_kategori || 'Umum'}
        </span>

        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
            tersedia
              ? 'bg-brand-50 text-brand-700 ring-brand-200'
              : 'bg-slate-100 text-slate-500 ring-slate-200'
          }`}
        >
          {!alat.boleh_dipinjam
            ? 'Tidak dipinjamkan'
            : tersedia
              ? `Tersedia ${alat.jumlah_tersedia}`
              : 'Sedang habis'}
        </span>
      </div>

      {alat.jumlah_rusak > 0 && (
        <p className="mt-2 flex items-center gap-1 text-xs text-amber-600">
          <Wrench size={12} /> {alat.jumlah_rusak} unit rusak
        </p>
      )}
    </Link>
  );
}

function Penomoran({ halaman, totalHalaman, onPindah }) {
  return (
    <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Navigasi halaman">
      <button
        type="button"
        onClick={() => onPindah(halaman - 1)}
        disabled={halaman <= 1}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 disabled:opacity-40"
      >
        Sebelumnya
      </button>
      <span className="text-sm text-slate-500">
        Halaman {halaman} dari {totalHalaman}
      </span>
      <button
        type="button"
        onClick={() => onPindah(halaman + 1)}
        disabled={halaman >= totalHalaman}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 disabled:opacity-40"
      >
        Berikutnya
      </button>
    </nav>
  );
}
