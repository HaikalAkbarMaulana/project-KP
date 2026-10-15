import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ShieldAlert } from 'lucide-react';

import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { berandaPeran } from '../components/RuteAdmin';
import { PesanGalat } from '../components/Keadaan';

const MIN_SANDI = 8;

/**
 * Ganti kata sandi sendiri.
 *
 * Dipakai dua keadaan: wajib (kata sandi masih NIP bawaan, aplikasi belum
 * bisa dipakai sampai diganti) dan sukarela. Bedanya hanya pada kata sandi
 * lama — saat wajib, pengguna baru saja membuktikannya dengan berhasil
 * masuk, jadi tidak diminta lagi.
 */
export default function GantiSandi() {
  const { pengguna, harusGantiSandi, peran, masuk, keluar } = useAuth();
  const navigate = useNavigate();

  const [sandiLama, setSandiLama] = useState('');
  const [sandiBaru, setSandiBaru] = useState('');
  const [ulangi, setUlangi] = useState('');
  const [terlihat, setTerlihat] = useState(false);
  const [galat, setGalat] = useState('');
  const [mengirim, setMengirim] = useState(false);

  if (!pengguna) return <Navigate to="/masuk" replace />;

  async function kirim(e) {
    e.preventDefault();
    setGalat('');

    if (sandiBaru !== ulangi) {
      setGalat('Ulangi kata sandi tidak sama dengan kata sandi baru.');
      return;
    }
    if (sandiBaru.length < MIN_SANDI) {
      setGalat(`Kata sandi baru minimal ${MIN_SANDI} karakter.`);
      return;
    }
    // Diperiksa juga di server; di sini hanya supaya pesannya muncul
    // seketika tanpa menunggu permintaan bolak-balik.
    if (pengguna.nip && sandiBaru === pengguna.nip) {
      setGalat('Kata sandi baru tidak boleh sama dengan NIP Anda.');
      return;
    }

    setMengirim(true);

    try {
      await api.post('/akun/ganti-sandi', {
        ...(harusGantiSandi ? {} : { sandi_lama: sandiLama }),
        sandi_baru: sandiBaru,
      });
    } catch (err) {
      setGalat(err.message);
      setMengirim(false);
      return;
    }

    // Mulai dari sini kata sandinya SUDAH berganti. Kegagalan apa pun
    // setelah ini tidak boleh terbaca seolah penggantiannya batal.
    //
    // Supabase mencabut sesi lama begitu kata sandinya berubah, jadi harus
    // masuk ulang. Tanpa itu layar masih tampak seperti sudah masuk padahal
    // setiap permintaan berikutnya dijawab 401 — pengguna baru sadar ketika
    // halaman dimuat ulang dan tiba-tiba terlempar keluar.
    try {
      await masuk(pengguna.nip ?? pengguna.email, sandiBaru);
      navigate(berandaPeran(peran), { replace: true });
    } catch (err) {
      setGalat(
        `Kata sandi berhasil diganti, tapi sesi barunya gagal dibuat (${err.message}). ` +
        'Silakan masuk lagi memakai kata sandi yang baru.'
      );
      setMengirim(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-ink-900 to-ink-800 px-4 py-10">
      <div className="w-full max-w-sm">
        <form onSubmit={kirim} className="space-y-4 rounded-2xl bg-white p-6 shadow-xl">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <ShieldAlert size={22} />
            </div>
            <h1 className="font-display text-lg font-bold text-ink-900">
              {harusGantiSandi ? 'Ganti Kata Sandi Dulu' : 'Ganti Kata Sandi'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {harusGantiSandi
                ? 'Kata sandi Anda masih NIP bawaan. NIP tertulis di dokumen sekolah, jadi gantilah dengan yang hanya Anda tahu.'
                : `Masuk sebagai ${pengguna.nama}.`}
            </p>
          </div>

          <PesanGalat pesan={galat} />

          {!harusGantiSandi && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Kata sandi lama</span>
              <input
                type="password" required autoComplete="current-password"
                value={sandiLama} onChange={(e) => setSandiLama(e.target.value)}
                className="input"
              />
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              Kata sandi baru <span className="text-slate-400">(minimal {MIN_SANDI} karakter)</span>
            </span>
            <div className="relative">
              <input
                type={terlihat ? 'text' : 'password'}
                required autoComplete="new-password" minLength={MIN_SANDI}
                value={sandiBaru} onChange={(e) => setSandiBaru(e.target.value)}
                className="input pr-11"
              />
              <button
                type="button"
                onClick={() => setTerlihat((t) => !t)}
                aria-label={terlihat ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                {terlihat ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Ulangi kata sandi baru</span>
            <input
              type={terlihat ? 'text' : 'password'}
              required autoComplete="new-password"
              value={ulangi} onChange={(e) => setUlangi(e.target.value)}
              className="input"
            />
          </label>

          <button
            type="submit"
            disabled={mengirim}
            className="w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {mengirim ? 'Menyimpan...' : 'Simpan kata sandi baru'}
          </button>

          <button
            type="button"
            onClick={async () => { await keluar(); navigate('/', { replace: true }); }}
            className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50"
          >
            Keluar
          </button>
        </form>
      </div>
    </div>
  );
}
