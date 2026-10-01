import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Bell, Menu } from 'lucide-react';

import SidebarAdmin from './SidebarAdmin';
import { useAuth } from '../context/AuthContext';
import { useAmbilData } from '../hooks/useAmbilData';

export default function AdminLayout() {
  const { admin } = useAuth();
  const lokasi = useLocation();
  const [menuTerbuka, setMenuTerbuka] = useState(false);

  // Jumlah pengajuan yang menunggu ditinjau, disegarkan tiap pindah halaman.
  const { data, muatUlang } = useAmbilData('/peminjaman?status=pending&per_halaman=1');
  const menunggu = data?.halaman?.total ?? 0;

  // Pengambilan pertama sudah dilakukan useAmbilData saat dipasang, jadi
  // penyegaran di sini baru dijalankan mulai perpindahan halaman berikutnya.
  const pertamaKali = useRef(true);
  useEffect(() => {
    setMenuTerbuka(false);
    if (pertamaKali.current) {
      pertamaKali.current = false;
      return;
    }
    muatUlang();
  }, [lokasi.pathname, muatUlang]);

  const hariIni = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

  return (
    <div className="wadah-admin min-h-screen bg-slate-50 lg:pl-64">
      <div className="tanpa-cetak">
        <SidebarAdmin terbuka={menuTerbuka} onTutup={() => setMenuTerbuka(false)} />
      </div>

      <header className="tanpa-cetak sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setMenuTerbuka(true)}
            aria-label="Buka menu"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            <Menu size={20} />
          </button>
          <div className="min-w-0">
            <h1 className="font-display truncate text-base font-bold text-ink-900 sm:text-lg">
              Panel Admin Lab
            </h1>
            <p className="truncate text-xs text-slate-500 sm:text-sm">{hariIni}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Link
            to="/admin/peminjaman?status=pending"
            title={`${menunggu} pengajuan menunggu ditinjau`}
            className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100"
          >
            <Bell size={20} />
            {menunggu > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white">
                {menunggu > 99 ? '99+' : menunggu}
              </span>
            )}
            <span className="sr-only">{menunggu} pengajuan menunggu ditinjau</span>
          </Link>
          <div
            title={admin?.email}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white"
          >
            {admin?.nama?.[0]?.toUpperCase() || 'A'}
          </div>
        </div>
      </header>

      <main className="area-cetak p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
