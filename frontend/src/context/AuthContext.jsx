import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { api } from '../lib/api';

const AuthContext = createContext(null);

/**
 * Status sesi admin.
 *
 * Aplikasi ini hanya punya satu jenis akun: admin/petugas lab. Punya sesi
 * Supabase saja belum berarti admin — backend yang memutuskan, lewat
 * GET /api/admin/saya. Frontend tidak membaca tabel profil langsung supaya
 * aturan "siapa yang boleh masuk" hanya ada di satu tempat.
 *
 * Catatan penting soal urutan: `memuat` baru menjadi false setelah profil
 * selesai diambil. Versi sebelumnya menandai selesai sebelum profil tiba,
 * sehingga admin yang membuka /admin sempat terbaca sebagai bukan-admin dan
 * langsung dilempar ke beranda.
 */
export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [memuat, setMemuat] = useState(true);

  // Menandai permintaan profil terakhir. Kalau pengguna cepat keluar-masuk,
  // balasan yang datang terlambat tidak boleh menimpa keadaan terbaru.
  const permintaanTerakhir = useRef(0);

  const segarkanAdmin = useCallback(async (adaSesi) => {
    const nomor = ++permintaanTerakhir.current;

    if (!adaSesi) {
      if (nomor === permintaanTerakhir.current) {
        setAdmin(null);
        setMemuat(false);
      }
      return { profil: null, galat: null };
    }

    try {
      const res = await api.get('/admin/saya');
      // Hasilnya selalu dikembalikan ke pemanggil; yang dijaga penanda
      // hanya penulisan state. Kalau nilai baliknya ikut dibuang saat
      // penanda kedaluwarsa, masuk() bisa salah menyimpulkan bahwa akun
      // yang sah bukan admin — padahal permintaannya cuma didahului
      // pendengar onAuthStateChange yang menanyakan orang yang sama.
      if (nomor === permintaanTerakhir.current) setAdmin(res.data);
      return { profil: res.data, galat: null };
    } catch (err) {
      if (nomor === permintaanTerakhir.current) setAdmin(null);
      return { profil: null, galat: err };
    } finally {
      if (nomor === permintaanTerakhir.current) setMemuat(false);
    }
  }, []);

  useEffect(() => {
    let aktif = true;

    supabase.auth.getSession().then(({ data }) => {
      if (aktif) segarkanAdmin(!!data.session);
    });

    const { data: pendengar } = supabase.auth.onAuthStateChange((peristiwa, sesi) => {
      // INITIAL_SESSION sudah ditangani getSession() di atas, dan
      // TOKEN_REFRESHED hanya memperbarui token tanpa mengubah profil.
      // Keduanya dilewati agar tidak ada permintaan API yang mubazir.
      if (peristiwa === 'INITIAL_SESSION' || peristiwa === 'TOKEN_REFRESHED') return;
      segarkanAdmin(!!sesi);
    });

    return () => {
      aktif = false;
      pendengar.subscription.unsubscribe();
    };
  }, [segarkanAdmin]);

  const masuk = useCallback(async (email, password) => {
    setMemuat(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMemuat(false);
      throw new Error(
        error.message === 'Invalid login credentials'
          ? 'Email atau kata sandi salah.'
          : error.message
      );
    }

    const { profil, galat } = await segarkanAdmin(!!data.session);

    if (!profil) {
      // Sesinya langsung ditutup agar tidak menggantung.
      await supabase.auth.signOut();
      setAdmin(null);
      setMemuat(false);

      // Bedakan "bukan admin" dari "server bermasalah". Keduanya sama-sama
      // membuat pengambilan profil gagal, tapi hanya 401/403 yang benar-benar
      // berarti akunnya tidak berhak. Menyamakan keduanya bikin gangguan
      // server atau skema database yang belum dimigrasi terbaca seolah-olah
      // kata sandinya yang salah.
      const bukanAdmin = galat?.status === 401 || galat?.status === 403;
      throw new Error(
        bukanAdmin
          ? 'Akun ini tidak terdaftar sebagai admin lab. Hubungi petugas lab.'
          : `Kata sandi benar, tapi data admin gagal dimuat. ${galat?.message || ''}`.trim()
      );
    }

    return profil;
  }, [segarkanAdmin]);

  const keluar = useCallback(async () => {
    await supabase.auth.signOut();
    setAdmin(null);
  }, []);

  const nilai = useMemo(
    () => ({ admin, memuat, sudahMasuk: !!admin, masuk, keluar }),
    [admin, memuat, masuk, keluar]
  );

  return <AuthContext.Provider value={nilai}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const konteks = useContext(AuthContext);
  if (!konteks) throw new Error('useAuth harus dipakai di dalam <AuthProvider>.');
  return konteks;
}
