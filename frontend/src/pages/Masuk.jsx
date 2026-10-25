import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useLocation, Link } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import LogoSekolah from '../components/LogoSekolah';

import { useAuth } from '../context/AuthContext';
import { berandaPeran } from '../components/RuteAdmin';
import { Memuat, PesanGalat } from '../components/Keadaan';

/**
 * Satu halaman masuk untuk kedua peran.
 *
 * Guru mengetik NIP, petugas lab mengetik email, dan keduanya memakai kotak
 * isian yang sama. Dengan begitu tidak ada yang perlu memilih lebih dulu
 * "saya ini yang mana" — tujuan setelah masuk ditentukan peran yang
 * dikembalikan backend, bukan oleh pintu mana yang diketuk.
 */
export default function Masuk() {
  const { masuk, sudahMasuk, memuat, peran, harusGantiSandi, alasanKeluar, lupakanAlasanKeluar } = useAuth();
  const navigate = useNavigate();
  const lokasi = useLocation();

  const [identitas, setIdentitas] = useState('');
  const [sandi, setSandi] = useState('');
  const [sandiTerlihat, setSandiTerlihat] = useState(false);
  const [galat, setGalat] = useState('');
  const [mengirim, setMengirim] = useState(false);

  // Alasan dari sesi yang terputus di tengah jalan -- misalnya akunnya baru
  // saja dinonaktifkan petugas. Ditampilkan sekali, lalu dilupakan supaya
  // tidak menempel saat halaman ini dibuka lagi nanti.
  useEffect(() => {
    if (alasanKeluar) {
      setGalat(alasanKeluar);
      lupakanAlasanKeluar();
    }
  }, [alasanKeluar, lupakanAlasanKeluar]);

  if (memuat) return <Memuat pesan="Memeriksa sesi..." />;

  if (sudahMasuk) {
    if (harusGantiSandi) return <Navigate to="/ganti-sandi" replace />;
    return <Navigate to={lokasi.state?.tujuan || berandaPeran(peran)} replace />;
  }

  async function kirim(e) {
    e.preventDefault();
    setGalat('');
    setMengirim(true);

    try {
      const profil = await masuk(identitas.trim(), sandi);

      if (profil.harus_ganti_sandi) {
        navigate('/ganti-sandi', { replace: true });
        return;
      }

      // Alamat yang tadi dituju hanya dipakai bila memang milik peran ini;
      // kalau tidak, penjaga rutenya akan memantulkannya lagi.
      const tujuan = lokasi.state?.tujuan || berandaPeran(profil.peran);
      navigate(tujuan, { replace: true });
    } catch (err) {
      setGalat(err.message);
      setMengirim(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-ink-900 to-ink-800 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <LogoSekolah ukuran={96} kelas="mx-auto mb-4 h-20 w-20 drop-shadow-lg" />
          <h1 className="font-display text-2xl font-bold text-white">Masuk</h1>
          <p className="mt-1 text-sm text-slate-400">SMP Negeri 3 Kedungreja</p>
        </div>

        <form onSubmit={kirim} className="space-y-4 rounded-2xl bg-white p-6 shadow-xl">
          <PesanGalat pesan={galat} />

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">NIP atau Email</span>
            <input
              // Sengaja bukan type="email": guru mengetik NIP, yang akan
              // ditolak validasi bawaan browser untuk kolom email.
              type="text"
              required
              autoComplete="username"
              inputMode="text"
              value={identitas}
              onChange={(e) => setIdentitas(e.target.value)}
              className="input"
              placeholder="NIP guru, atau email petugas lab"
            />
            <span className="mt-1 block text-xs text-slate-400">
              Guru: masukkan NIP. Petugas lab: masukkan email.
            </span>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Kata Sandi</span>
            <div className="relative">
              <input
                type={sandiTerlihat ? 'text' : 'password'}
                required autoComplete="current-password" value={sandi}
                onChange={(e) => setSandi(e.target.value)}
                className="input pr-11"
              />
              <button
                type="button"
                onClick={() => setSandiTerlihat((t) => !t)}
                aria-label={sandiTerlihat ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                {sandiTerlihat ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={mengirim}
            className="w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {mengirim ? 'Memproses...' : 'Masuk'}
          </button>

          <p className="border-t border-slate-100 pt-4 text-center text-xs text-slate-500">
            Belum punya akun atau lupa kata sandi? Hubungi petugas lab — akun guru
            didaftarkan dan disetel ulang dari panel admin.
          </p>
        </form>

        <Link
          to="/"
          className="mt-6 flex items-center justify-center gap-1.5 text-sm text-slate-400 hover:text-white"
        >
          <ArrowLeft size={14} /> Kembali ke halaman publik
        </Link>
      </div>
    </div>
  );
}
