import { useState } from 'react';
import { Navigate, useNavigate, useLocation, Link } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import LogoSekolah from '../../components/LogoSekolah';

import { useAuth } from '../../context/AuthContext';
import { Memuat, PesanGalat } from '../../components/Keadaan';

/**
 * Satu-satunya halaman masuk di aplikasi ini, dan khusus untuk petugas lab.
 * Guru tidak punya akun — mereka mengajukan peminjaman lewat form publik.
 */
export default function MasukAdmin() {
  const { masuk, sudahMasuk, memuat } = useAuth();
  const navigate = useNavigate();
  const lokasi = useLocation();

  const [email, setEmail] = useState('');
  const [sandi, setSandi] = useState('');
  const [sandiTerlihat, setSandiTerlihat] = useState(false);
  const [galat, setGalat] = useState('');
  const [mengirim, setMengirim] = useState(false);

  const tujuan = lokasi.state?.tujuan || '/admin';

  if (memuat) return <Memuat pesan="Memeriksa sesi..." />;
  if (sudahMasuk) return <Navigate to={tujuan} replace />;

  async function kirim(e) {
    e.preventDefault();
    setGalat('');
    setMengirim(true);

    try {
      await masuk(email.trim(), sandi);
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
          <h1 className="font-display text-2xl font-bold text-white">Panel Admin Lab</h1>
          <p className="mt-1 text-sm text-slate-400">SMP Negeri 3 Kedungreja</p>
        </div>

        <form onSubmit={kirim} className="space-y-4 rounded-2xl bg-white p-6 shadow-xl">
          <PesanGalat pesan={galat} />

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Email</span>
            <input
              type="email" required autoComplete="username" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input" placeholder="petugas@sekolah.sch.id"
            />
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
            Halaman ini hanya untuk petugas lab. Guru dapat mengajukan peminjaman
            langsung dari katalog tanpa akun.
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
