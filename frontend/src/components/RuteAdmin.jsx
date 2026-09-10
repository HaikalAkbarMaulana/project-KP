import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Memuat } from './Keadaan';

/**
 * Penjaga seluruh halaman /admin.
 *
 * Selama status sesi belum pasti, halaman menampilkan penanda memuat dan
 * TIDAK mengalihkan ke mana pun. Pengalihan saat status masih ragu itulah
 * yang dulu membuat admin terlempar ke beranda begitu menyegarkan halaman
 * panel admin.
 *
 * Alamat yang sedang dituju dititipkan lewat state agar setelah berhasil
 * masuk pengguna kembali ke halaman itu, bukan selalu ke dashboard.
 */
export default function RuteAdmin({ children }) {
  const { sudahMasuk, memuat } = useAuth();
  const lokasi = useLocation();

  if (memuat) return <Memuat pesan="Memeriksa sesi..." />;

  if (!sudahMasuk) {
    return <Navigate to="/admin/masuk" replace state={{ tujuan: lokasi.pathname + lokasi.search }} />;
  }

  return children;
}
