import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, LogOut, ShieldCheck, ClipboardList } from 'lucide-react';
import LogoSekolah from './LogoSekolah';
import { useAuth } from '../context/AuthContext';

// labelPendek dipakai di layar sempit. Dengan label penuh, menu membungkus
// jadi dua baris dan mendesak tombol di kanan sampai terpotong.
const tautanNav = [
  { to: '/', label: 'Katalog Alat', labelPendek: 'Katalog', akhir: true },
  { to: '/lacak', label: 'Lacak Pengajuan', labelPendek: 'Lacak' },
];

export default function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4">
          <Link to="/" className="flex shrink-0 items-center gap-2.5 sm:gap-3">
            <LogoSekolah ukuran={40} kelas="h-9 w-9 sm:h-10 sm:w-10" />
            <div>
              <p className="font-display text-sm font-bold leading-tight text-ink-900">LabPinjam</p>
              {/* Nama panjang hanya di layar lebar; di ponsel ia mendesak
                  tombol petugas sampai terpotong di tepi kanan. */}
              <p className="text-xs text-slate-500">
                <span className="sm:hidden">SMPN 3 Kedungreja</span>
                <span className="hidden sm:inline">SMP Negeri 3 Kedungreja</span>
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-1 sm:gap-3">
            <nav className="flex items-center gap-1 text-sm font-medium sm:gap-2">
              {tautanNav.map(({ to, label, labelPendek, akhir }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={akhir}
                  className={({ isActive }) =>
                    `whitespace-nowrap rounded-lg px-2 py-1.5 sm:px-3 ${
                      isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:text-brand-700'
                    }`
                  }
                >
                  <span className="sm:hidden">{labelPendek}</span>
                  <span className="hidden sm:inline">{label}</span>
                </NavLink>
              ))}
            </nav>

            <TombolAkun />
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-6 text-center text-sm text-slate-500">
          <LogoSekolah ukuran={32} kelas="h-8 w-8 opacity-70" />
          <p>© {new Date().getFullYear()} SMP Negeri 3 Kedungreja — Inventaris &amp; Peminjaman Alat Lab</p>
        </div>
      </footer>
    </div>
  );
}

/**
 * Tombol pojok kanan atas.
 *
 * Satu pintu untuk kedua peran: selama belum masuk ia berupa tombol
 * "Masuk", dan setelah masuk ia berganti menjadi jalan pintas ke tempat
 * masing-masing — panel admin bagi petugas lab, Peminjaman Saya bagi guru.
 * Di layar sempit tulisannya disembunyikan agar menu utama tidak terdesak.
 */
function TombolAkun() {
  const { sudahMasuk, adalahAdmin, memuat, keluar } = useAuth();
  const lokasi = useLocation();
  const navigate = useNavigate();

  // Selama status sesi belum pasti, ruangnya tetap dipesan supaya tata
  // letak kepala halaman tidak melompat begitu sesinya diketahui.
  if (memuat) return <div className="h-8 w-8 shrink-0 sm:w-24" aria-hidden="true" />;

  if (!sudahMasuk) {
    return (
      <Link
        to="/masuk"
        state={{ tujuan: lokasi.pathname + lokasi.search }}
        title="Masuk sebagai guru atau petugas lab"
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 sm:px-3"
      >
        <LogIn size={15} />
        <span className="hidden sm:inline">Masuk</span>
        <span className="sr-only sm:hidden">Masuk</span>
      </Link>
    );
  }

  const tujuan = adalahAdmin ? '/admin' : '/guru/peminjaman';
  const label = adalahAdmin ? 'Panel admin' : 'Peminjaman Saya';
  const Ikon = adalahAdmin ? ShieldCheck : ClipboardList;

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Link
        to={tujuan}
        title={label}
        className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100 sm:px-3"
      >
        <Ikon size={15} />
        <span className="hidden sm:inline">{label}</span>
        <span className="sr-only sm:hidden">{label}</span>
      </Link>

      <button
        type="button"
        onClick={async () => { await keluar(); navigate('/', { replace: true }); }}
        title="Keluar"
        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
      >
        <LogOut size={15} />
        <span className="sr-only">Keluar</span>
      </button>
    </div>
  );
}
