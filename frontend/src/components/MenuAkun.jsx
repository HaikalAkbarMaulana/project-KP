import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ClipboardList, KeyRound, LogIn, LogOut, ShieldCheck, User } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { singkatNama } from '../lib/nama';

/**
 * Menu akun di pojok kanan bar atas.
 *
 * Sebelum masuk ia berupa tombol "Masuk". Setelah masuk, ia menjadi nama
 * pengguna yang bisa diklik — seluruh perintah yang berkaitan dengan akun
 * dikumpulkan di balik satu menu, alih-alih berjajar sebagai tombol
 * terpisah yang mendesak menu utama di layar sempit.
 */
export default function MenuAkun() {
  const { sudahMasuk, adalahAdmin, memuat, pengguna, keluar } = useAuth();
  const lokasi = useLocation();
  const navigate = useNavigate();

  const [terbuka, setTerbuka] = useState(false);
  const pembungkus = useRef(null);

  // Menu ditutup saat berpindah halaman. Tanpa ini ia tetap menggantung di
  // atas halaman baru setelah salah satu tautannya diklik.
  useEffect(() => setTerbuka(false), [lokasi.pathname]);

  useEffect(() => {
    if (!terbuka) return undefined;

    function klikDiLuar(e) {
      if (pembungkus.current && !pembungkus.current.contains(e.target)) setTerbuka(false);
    }
    function tekanEscape(e) {
      if (e.key === 'Escape') setTerbuka(false);
    }

    document.addEventListener('mousedown', klikDiLuar);
    document.addEventListener('keydown', tekanEscape);
    return () => {
      document.removeEventListener('mousedown', klikDiLuar);
      document.removeEventListener('keydown', tekanEscape);
    };
  }, [terbuka]);

  // Selama status sesi belum pasti, ruangnya tetap dipesan supaya tata
  // letak kepala halaman tidak melompat begitu sesinya diketahui.
  if (memuat) return <div className="h-9 w-9 shrink-0 sm:w-28" aria-hidden="true" />;

  if (!sudahMasuk) {
    return (
      <Link
        to="/masuk"
        state={{ tujuan: lokasi.pathname + lokasi.search }}
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 sm:px-3"
      >
        <LogIn size={16} />
        <span className="hidden sm:inline">Masuk</span>
        <span className="sr-only sm:hidden">Masuk</span>
      </Link>
    );
  }

  const peranTerbaca = adalahAdmin ? 'Petugas Lab' : 'Guru';
  const keterangan = [peranTerbaca, adalahAdmin ? pengguna.jabatan : pengguna.mapel]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="relative shrink-0" ref={pembungkus}>
      <button
        type="button"
        onClick={() => setTerbuka((t) => !t)}
        aria-haspopup="menu"
        aria-expanded={terbuka}
        className={`flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors sm:gap-2 sm:px-2.5 ${
          terbuka ? 'bg-slate-100 text-ink-900' : 'text-slate-600 hover:bg-slate-100 hover:text-ink-900'
        }`}
      >
        <User size={16} className="shrink-0 text-slate-400" />
        <span className="hidden max-w-[11rem] truncate sm:inline">{singkatNama(pengguna.nama)}</span>
        <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${terbuka ? 'rotate-180' : ''}`} />
        <span className="sr-only">Menu akun</span>
      </button>

      {terbuka && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="break-words text-sm font-semibold text-ink-900">{pengguna.nama}</p>
            <p className="mt-0.5 text-xs text-slate-500">{keterangan}</p>
            {pengguna.nip && (
              <p className="mt-0.5 break-all font-mono text-xs text-slate-400">NIP {pengguna.nip}</p>
            )}
          </div>

          <div className="py-1">
            {adalahAdmin ? (
              <ButirMenu ke="/admin" ikon={ShieldCheck} label="Panel Admin" />
            ) : (
              <ButirMenu ke="/guru/peminjaman" ikon={ClipboardList} label="Peminjaman Saya" />
            )}
            <ButirMenu ke="/ganti-sandi" ikon={KeyRound} label="Ganti Kata Sandi" />
          </div>

          <div className="border-t border-slate-100 py-1">
            <button
              type="button"
              role="menuitem"
              onClick={async () => {
                setTerbuka(false);
                await keluar();
                navigate('/', { replace: true });
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-700"
            >
              <LogOut size={15} className="shrink-0" /> Keluar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ButirMenu({ ke, ikon: Ikon, label }) {
  return (
    <Link
      to={ke}
      role="menuitem"
      className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-brand-700"
    >
      <Ikon size={15} className="shrink-0" /> {label}
    </Link>
  );
}
