import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import RuteAdmin, { RuteGuru, RuteSudahMasuk } from './components/RuteAdmin';
import { Memuat } from './components/Keadaan';

import PublicLayout from './components/PublicLayout';
import Beranda from './pages/public/Beranda';
import DetailAlat from './pages/public/DetailAlat';
import LacakPengajuan from './pages/public/LacakPengajuan';
import TidakDitemukan from './pages/public/TidakDitemukan';
import Masuk from './pages/Masuk';
import GantiSandi from './pages/GantiSandi';

const PeminjamanSaya = lazy(() => import('./pages/guru/PeminjamanSaya'));

// Panel admin dimuat terpisah dari halaman publik.
//
// Isinya (termasuk pustaka grafik Recharts yang berat) hanya diunduh saat
// petugas lab benar-benar membuka /admin. Guru yang cuma melihat katalog
// tidak perlu ikut menanggung ukurannya — penting karena banyak yang
// membukanya lewat ponsel dengan koneksi seadanya.
const AdminLayout = lazy(() => import('./components/AdminLayout'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const DataAlat = lazy(() => import('./pages/admin/DataAlat'));
const DataPeminjaman = lazy(() => import('./pages/admin/DataPeminjaman'));
const Laporan = lazy(() => import('./pages/admin/Laporan'));
const DataRuangan = lazy(() => import('./pages/admin/DataRuangan'));
const DataKategori = lazy(() => import('./pages/admin/DataKategori'));
const AkunAdmin = lazy(() => import('./pages/admin/AkunAdmin'));
const AkunGuru = lazy(() => import('./pages/admin/AkunGuru'));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<Memuat pesan="Menyiapkan halaman..." />}>
          <Routes>
            {/* Satu pintu masuk untuk kedua peran. */}
            <Route path="/masuk" element={<Masuk />} />
            <Route
              path="/ganti-sandi"
              element={<RuteSudahMasuk><GantiSandi /></RuteSudahMasuk>}
            />

            {/* Alamat lama masih dipakai orang yang sudah menyimpannya di
                penanda browser, jadi diarahkan ulang, bukan dibiarkan 404. */}
            <Route path="/admin/masuk" element={<Navigate to="/masuk" replace />} />

            {/* Halaman publik. Katalog tetap terbuka supaya siapa pun bisa
                melihat fasilitas lab; yang menuntut akun hanya formulir
                pengajuannya, yang muncul di halaman detail alat. */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Beranda />} />
              <Route path="/alat/:id" element={<DetailAlat />} />
              <Route path="/lacak" element={<LacakPengajuan />} />

              {/* Area guru. Katalognya sama dengan yang publik, jadi yang
                  perlu dijaga hanya riwayat miliknya sendiri. */}
              <Route
                path="/guru/peminjaman"
                element={<RuteGuru><PeminjamanSaya /></RuteGuru>}
              />
              <Route path="/guru" element={<Navigate to="/" replace />} />

              <Route path="*" element={<TidakDitemukan />} />
            </Route>

            {/* Panel admin — khusus petugas lab */}
            <Route path="/admin" element={<RuteAdmin><AdminLayout /></RuteAdmin>}>
              <Route index element={<Dashboard />} />
              <Route path="alat" element={<DataAlat />} />
              <Route path="peminjaman" element={<DataPeminjaman />} />
              <Route path="laporan" element={<Laporan />} />
              <Route path="ruangan" element={<DataRuangan />} />
              <Route path="kategori" element={<DataKategori />} />
              <Route path="guru" element={<AkunGuru />} />
              <Route path="akun" element={<AkunAdmin />} />
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
