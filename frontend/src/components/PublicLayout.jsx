import { Link, NavLink, Outlet } from 'react-router-dom';
import LogoSekolah from './LogoSekolah';
import MenuAkun from './MenuAkun';

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
                    // Hanya yang sedang dibuka yang berwarna. Kalau semua menu
                    // ikut hijau, tanda "saya sedang di halaman mana" hilang —
                    // padahal itu satu-satunya tugas warna di sini.
                    `whitespace-nowrap rounded-lg px-2.5 py-2 transition-colors sm:px-3 ${
                      isActive
                        ? 'bg-brand-500 text-white'
                        : 'text-slate-600 hover:bg-brand-50 hover:text-brand-700'
                    }`
                  }
                >
                  <span className="sm:hidden">{labelPendek}</span>
                  <span className="hidden sm:inline">{label}</span>
                </NavLink>
              ))}
            </nav>

            <MenuAkun />
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
