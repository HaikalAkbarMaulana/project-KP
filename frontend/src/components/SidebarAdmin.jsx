import { NavLink } from 'react-router-dom';
import {
  LayoutGrid, Boxes, ClipboardList, FileText, DoorOpen, Tags, Users, LogOut, X, ExternalLink,
} from 'lucide-react';
import LogoSekolah from './LogoSekolah';
import { useAuth } from '../context/AuthContext';

const menu = [
  { to: '/admin', label: 'Dashboard', ikon: LayoutGrid, akhir: true },
  { to: '/admin/alat', label: 'Data Inventaris', ikon: Boxes },
  { to: '/admin/peminjaman', label: 'Peminjaman', ikon: ClipboardList },
  { to: '/admin/laporan', label: 'Laporan', ikon: FileText },
  { to: '/admin/ruangan', label: 'Ruangan', ikon: DoorOpen },
  { to: '/admin/kategori', label: 'Kategori', ikon: Tags },
  { to: '/admin/akun', label: 'Akun Admin', ikon: Users },
];

export default function SidebarAdmin({ terbuka, onTutup }) {
  const { admin, keluar } = useAuth();

  return (
    <>
      {/* Latar gelap saat laci menu terbuka di layar kecil */}
      {terbuka && (
        <button
          type="button"
          aria-label="Tutup menu"
          onClick={onTutup}
          className="fixed inset-0 z-30 bg-ink-900/50 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-ink-900 text-slate-200 transition-transform lg:translate-x-0 ${
          terbuka ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-3 px-6 py-6">
          <div className="flex items-center gap-3">
            <LogoSekolah ukuran={40} kelas="h-10 w-10" />
            <div>
              <p className="font-display text-sm font-bold leading-tight text-white">LabPinjam</p>
              <p className="text-xs text-slate-400">SMP Negeri 3 Kedungreja</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onTutup}
            aria-label="Tutup menu"
            className="rounded-lg p-1 text-slate-400 hover:bg-ink-800 hover:text-white lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mx-4 mb-4 rounded-xl bg-ink-800 px-4 py-3">
          <p className="text-xs text-slate-400">Masuk sebagai</p>
          <p className="truncate text-sm font-semibold text-white">{admin?.nama || '...'}</p>
          {admin?.jabatan && <p className="truncate text-xs text-slate-400">{admin.jabatan}</p>}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {menu.map(({ to, label, ikon: Ikon, akhir }) => (
            <NavLink
              key={to}
              to={to}
              end={akhir}
              onClick={onTutup}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-500 text-white' : 'text-slate-300 hover:bg-ink-800 hover:text-white'
                }`
              }
            >
              <Ikon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-1 p-3">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-ink-800 hover:text-white"
          >
            <ExternalLink size={18} />
            Lihat halaman publik
          </a>
          <button
            type="button"
            onClick={keluar}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-300 transition-colors hover:bg-ink-800"
          >
            <LogOut size={18} />
            Keluar
          </button>
        </div>
      </aside>
    </>
  );
}
