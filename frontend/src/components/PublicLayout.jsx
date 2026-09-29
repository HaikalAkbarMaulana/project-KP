import { Link, NavLink, Outlet } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import LogoSekolah from './LogoSekolah';

// labelPendek dipakai di layar sempit. Dengan label penuh, menu membungkus
// jadi dua baris dan mendesak tombol petugas sampai terpotong di tepi kanan.
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

            {/* Pintu masuk petugas lab. Sengaja dibedakan dari menu di
                sebelahnya: ini bukan untuk guru, yang tidak perlu akun sama
                sekali. Di layar sempit tinggal ikonnya saja agar menu utama
                tidak terdesak. */}
            <Link
              to="/admin/masuk"
              title="Masuk sebagai petugas lab"
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 sm:px-3"
            >
              <ShieldCheck size={15} />
              <span className="hidden sm:inline">Masuk sebagai petugas</span>
              <span className="sr-only sm:hidden">Masuk sebagai petugas lab</span>
            </Link>
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
