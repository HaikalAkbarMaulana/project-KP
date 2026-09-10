import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import RuteAdmin from './components/RuteAdmin';
import { Memuat } from './components/Keadaan';

import PublicLayout from './components/PublicLayout';
import Beranda from './pages/public/Beranda';
import DetailAlat from './pages/public/DetailAlat';
import LacakPengajuan from './pages/public/LacakPengajuan';
import TidakDitemukan from './pages/public/TidakDitemukan';

// Panel admin dimuat terpisah dari halaman publik.
//
// Isinya (termasuk pustaka grafik Recharts yang berat) hanya diunduh saat
// petugas lab benar-benar membuka /admin. Guru yang cuma melihat katalog
// tidak perlu ikut menanggung ukurannya — penting karena banyak yang
// membukanya lewat ponsel dengan koneksi seadanya.
const AdminLayout = lazy(() => import('./components/AdminLayout'));
const MasukAdmin = lazy(() => import('./pages/admin/MasukAdmin'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const DataAlat = lazy(() => import('./pages/admin/DataAlat'));
const DataPeminjaman = lazy(() => import('./pages/admin/DataPeminjaman'));
const DataRuangan = lazy(() => import('./pages/admin/DataRuangan'));
const DataKategori = lazy(() => import('./pages/admin/DataKategori'));
const AkunAdmin = lazy(() => import('./pages/admin/AkunAdmin'));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<Memuat pesan="Menyiapkan halaman..." />}>
          <Routes>
            {/* Halaman publik — tanpa login */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Beranda />} />
              <Route path="/alat/:id" element={<DetailAlat />} />
              <Route path="/lacak" element={<LacakPengajuan />} />
              <Route path="*" element={<TidakDitemukan />} />
            </Route>

            {/* Panel admin — khusus petugas lab */}
            <Route path="/admin/masuk" element={<MasukAdmin />} />
            <Route path="/admin" element={<RuteAdmin><AdminLayout /></RuteAdmin>}>
              <Route index element={<Dashboard />} />
              <Route path="alat" element={<DataAlat />} />
              <Route path="peminjaman" element={<DataPeminjaman />} />
              <Route path="ruangan" element={<DataRuangan />} />
              <Route path="kategori" element={<DataKategori />} />
              <Route path="akun" element={<AkunAdmin />} />
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
