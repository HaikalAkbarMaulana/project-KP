import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Memuat } from './Keadaan';

/**
 * Ke mana seseorang semestinya berada, menurut perannya.
 *
 * Guru diantar ke katalog publik, bukan ke URL tersendiri: katalognya
 * memang sama persis, dan menyalinnya ke /guru hanya akan melahirkan dua
 * halaman yang harus dirawat bersamaan. Yang membedakan guru hanyalah
 * munculnya formulir pengajuan dan menu Peminjaman Saya.
 */
export function berandaPeran(peran) {
  return peran === 'admin' ? '/admin' : '/';
}

/**
 * Penjaga halaman yang menuntut peran tertentu.
 *
 * Selama status sesi belum pasti, halaman menampilkan penanda memuat dan
 * TIDAK mengalihkan ke mana pun. Pengalihan saat status masih ragu itulah
 * yang dulu membuat admin terlempar ke beranda begitu menyegarkan halaman
 * panel admin.
 *
 * Alamat yang sedang dituju dititipkan lewat state agar setelah berhasil
 * masuk pengguna kembali ke halaman itu, bukan selalu ke halaman depan
 * perannya.
 */
function Penjaga({ peranDibutuhkan, children }) {
  const { sudahMasuk, memuat, peran, harusGantiSandi } = useAuth();
  const lokasi = useLocation();

  if (memuat) return <Memuat pesan="Memeriksa sesi..." />;

  if (!sudahMasuk) {
    return <Navigate to="/masuk" replace state={{ tujuan: lokasi.pathname + lokasi.search }} />;
  }

  // Kata sandi awal yang belum diganti menutup seluruh aplikasi, bukan
  // cuma menampilkan peringatan. Backend menolak permintaannya juga, jadi
  // pengalihan ini sekadar membuat layarnya masuk akal — bukan pengaman
  // satu-satunya.
  if (harusGantiSandi) return <Navigate to="/ganti-sandi" replace />;

  // Masuk sebagai peran lain: antarkan ke tempatnya sendiri, jangan
  // lempar ke halaman masuk — sesinya sah, cuma salah pintu.
  if (peran !== peranDibutuhkan) return <Navigate to={berandaPeran(peran)} replace />;

  return children;
}

export default function RuteAdmin({ children }) {
  return <Penjaga peranDibutuhkan="admin">{children}</Penjaga>;
}

export function RuteGuru({ children }) {
  return <Penjaga peranDibutuhkan="guru">{children}</Penjaga>;
}

/**
 * Penjaga halaman ganti sandi wajib: cukup sudah masuk, peran apa pun,
 * dan justru TIDAK boleh mengalihkan saat harusGantiSandi bernilai true —
 * kalau ikut mengalihkan, halamannya akan memantul ke dirinya sendiri.
 */
export function RuteSudahMasuk({ children }) {
  const { sudahMasuk, memuat } = useAuth();
  const lokasi = useLocation();

  if (memuat) return <Memuat pesan="Memeriksa sesi..." />;
  if (!sudahMasuk) {
    return <Navigate to="/masuk" replace state={{ tujuan: lokasi.pathname + lokasi.search }} />;
  }
  return children;
}
