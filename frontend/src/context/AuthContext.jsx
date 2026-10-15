import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { api } from '../lib/api';
import { keEmailMasuk } from '../lib/akunGuru';

const AuthContext = createContext(null);

/**
 * Status sesi, untuk kedua peran: admin/petugas lab dan guru.
 *
 * Punya sesi Supabase saja belum berarti berhak — backend yang memutuskan,
 * lewat GET /api/akun/saya. Frontend tidak membaca tabel profil langsung
 * supaya aturan "siapa boleh apa" hanya ada di satu tempat.
 *
 * Catatan penting soal urutan: `memuat` baru menjadi false setelah profil
 * selesai diambil. Versi sebelumnya menandai selesai sebelum profil tiba,
 * sehingga admin yang membuka /admin sempat terbaca sebagai bukan-admin dan
 * langsung dilempar ke beranda.
 */
export function AuthProvider({ children }) {
  const [pengguna, setPengguna] = useState(null);
  const [memuat, setMemuat] = useState(true);

  // Menandai permintaan profil terakhir. Kalau pengguna cepat keluar-masuk,
  // balasan yang datang terlambat tidak boleh menimpa keadaan terbaru.
  const permintaanTerakhir = useRef(0);

  const segarkanProfil = useCallback(async (adaSesi) => {
    const nomor = ++permintaanTerakhir.current;

    if (!adaSesi) {
      if (nomor === permintaanTerakhir.current) {
        setPengguna(null);
        setMemuat(false);
      }
      return { profil: null, galat: null };
    }

    try {
      const res = await api.get('/akun/saya');
      // Hasilnya selalu dikembalikan ke pemanggil; yang dijaga penanda
      // hanya penulisan state. Kalau nilai baliknya ikut dibuang saat
      // penanda kedaluwarsa, masuk() bisa salah menyimpulkan bahwa akun
      // yang sah tidak berhak — padahal permintaannya cuma didahului
      // pendengar onAuthStateChange yang menanyakan orang yang sama.
      if (nomor === permintaanTerakhir.current) setPengguna(res.data);
      return { profil: res.data, galat: null };
    } catch (err) {
      if (nomor === permintaanTerakhir.current) setPengguna(null);
      return { profil: null, galat: err };
    } finally {
      if (nomor === permintaanTerakhir.current) setMemuat(false);
    }
  }, []);

  useEffect(() => {
    let aktif = true;

    supabase.auth.getSession().then(({ data }) => {
      if (aktif) segarkanProfil(!!data.session);
    });

    const { data: pendengar } = supabase.auth.onAuthStateChange((peristiwa, sesi) => {
      // INITIAL_SESSION sudah ditangani getSession() di atas, dan
      // TOKEN_REFRESHED hanya memperbarui token tanpa mengubah profil.
      // Keduanya dilewati agar tidak ada permintaan API yang mubazir.
      if (peristiwa === 'INITIAL_SESSION' || peristiwa === 'TOKEN_REFRESHED') return;
      segarkanProfil(!!sesi);
    });

    return () => {
      aktif = false;
      pendengar.subscription.unsubscribe();
    };
  }, [segarkanProfil]);

  /**
   * Masuk dengan NIP (guru) atau email (petugas lab).
   *
   * Satu kotak isian untuk keduanya; yang mengandung "@" dianggap email,
   * sisanya diperlakukan sebagai NIP dan diubah menjadi alamat internal.
   */
  const masuk = useCallback(async (identitas, password) => {
    setMemuat(true);
    const email = keEmailMasuk(identitas);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMemuat(false);
      throw new Error(
        error.message === 'Invalid login credentials'
          ? 'NIP/email atau kata sandi salah.'
          : error.message
      );
    }

    const { profil, galat } = await segarkanProfil(!!data.session);

    if (!profil) {
      // Sesinya langsung ditutup agar tidak menggantung.
      await supabase.auth.signOut();
      setPengguna(null);
      setMemuat(false);

      // Bedakan "tidak berhak" dari "server bermasalah". Keduanya sama-sama
      // membuat pengambilan profil gagal, tapi hanya 401/403 yang benar-benar
      // berarti akunnya tidak terdaftar. Menyamakan keduanya bikin gangguan
      // server atau skema database yang belum dimigrasi terbaca seolah-olah
      // kata sandinya yang salah.
      const tidakBerhak = galat?.status === 401 || galat?.status === 403;
      throw new Error(
        tidakBerhak
          ? 'Akun ini belum terdaftar di aplikasi. Hubungi petugas lab.'
          : `Kata sandi benar, tapi data akun gagal dimuat. ${galat?.message || ''}`.trim()
      );
    }

    return profil;
  }, [segarkanProfil]);

  const keluar = useCallback(async () => {
    await supabase.auth.signOut();
    setPengguna(null);
  }, []);

  const nilai = useMemo(
    () => ({
      pengguna,
      peran: pengguna?.peran ?? null,
      memuat,
      sudahMasuk: !!pengguna,
      adalahAdmin: pengguna?.peran === 'admin',
      adalahGuru: pengguna?.peran === 'guru',
      harusGantiSandi: !!pengguna?.harus_ganti_sandi,
      // Nama lama. Sengaja hanya terisi untuk peran admin supaya komponen
      // panel admin yang memakainya tidak pernah menerima akun guru.
      admin: pengguna?.peran === 'admin' ? pengguna : null,
      masuk,
      keluar,
      segarkanProfil,
    }),
    [pengguna, memuat, masuk, keluar, segarkanProfil]
  );

  return <AuthContext.Provider value={nilai}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const konteks = useContext(AuthContext);
  if (!konteks) throw new Error('useAuth harus dipakai di dalam <AuthProvider>.');
  return konteks;
}
