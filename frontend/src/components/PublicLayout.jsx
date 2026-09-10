import { Link, NavLink, Outlet } from 'react-router-dom';
import { FlaskConical, Search, ShieldCheck } from 'lucide-react';

const tautanNav = [
  { to: '/', label: 'Katalog Alat', akhir: true },
  { to: '/lacak', label: 'Lacak Pengajuan', ikon: Search },
];

export default function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4">
          <Link to="/" className="flex shrink-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white">
              <FlaskConical size={18} />
            </div>
            <div>
              <p className="font-display text-sm font-bold leading-tight text-ink-900">LabPinjam</p>
              <p className="text-xs text-slate-500">SMPN 3 Kedungreja</p>
            </div>
          </Link>

          <nav className="flex items-center gap-1 text-sm font-medium sm:gap-4">
            {tautanNav.map(({ to, label, akhir }) => (
              <NavLink
                key={to}
                to={to}
                end={akhir}
                className={({ isActive }) =>
                  `rounded-lg px-2.5 py-1.5 sm:px-3 ${
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:text-brand-700'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-6 text-center text-sm text-slate-500 sm:flex-row sm:justify-between sm:text-left">
          <p>© {new Date().getFullYear()} SMPN 3 Kedungreja — Inventaris & Peminjaman Alat Lab</p>
          {/* Pintu masuk petugas lab. Guru tidak perlu akun sama sekali. */}
          <Link
            to="/admin/masuk"
            className="flex items-center gap-1.5 text-slate-400 hover:text-brand-700"
          >
            <ShieldCheck size={14} /> Masuk sebagai petugas lab
          </Link>
        </div>
      </footer>
    </div>
  );
}
