import { supabaseAdmin } from '../supabaseClient.js';
import { GalatAplikasi } from '../lib/galat.js';
import { karenaKolomHilang, PESAN_SKEMA_LAMA } from '../lib/periksaSkema.js';

/**
 * Mengambil data admin dari token Authorization, bila ada.
 *
 * Mengembalikan objek { profil, galat } — `galat` berisi pesan siap tampil
 * kalau tokennya ada tapi tidak sah.
 */
async function bacaAdminDariToken(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) return { profil: null, galat: null };

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return { profil: null, galat: { status: 401, pesan: 'Sesi tidak valid atau sudah kedaluwarsa. Silakan masuk lagi.' } };
  }

  const { data: profil, error: profilError } = await supabaseAdmin
    .from('profil')
    .select('id, nama, email, jabatan, no_hp, aktif')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profilError) {
    // Kolom yang belum ada berarti migrasinya belum dijalankan. Ini kondisi
    // pemasangan, bukan kesalahan pengguna — pesannya dibuat langsung
    // menunjuk penyebabnya daripada berakhir sebagai "kesalahan server"
    // yang di layar login terbaca seolah akunnya yang bermasalah.
    if (karenaKolomHilang(profilError)) throw new GalatAplikasi(PESAN_SKEMA_LAMA, 503);
    throw profilError;
  }

  if (!profil) {
    return {
      profil: null,
      galat: {
        status: 403,
        pesan: 'Akun ini tidak terdaftar sebagai admin lab. Hubungi petugas lab untuk didaftarkan.',
      },
    };
  }

  if (!profil.aktif) {
    return { profil: null, galat: { status: 403, pesan: 'Akun Anda dinonaktifkan. Hubungi admin lab.' } };
  }

  return { profil, galat: null };
}

/**
 * Verifikasi sesi admin — wajib.
 *
 * Aplikasi ini hanya mengenal SATU jenis akun: admin/petugas lab. Punya akun
 * di Supabase Auth saja tidak cukup, harus ada baris aktif di tabel `profil`.
 * Jadi seandainya ada yang berhasil mendaftar sendiri lewat Supabase, ia tetap
 * tidak bisa masuk panel admin sampai didaftarkan oleh admin yang sudah ada.
 */
export async function wajibAdmin(req, res, next) {
  try {
    const { profil, galat } = await bacaAdminDariToken(req);

    if (!profil) {
      const { status, pesan } = galat || { status: 401, pesan: 'Anda belum masuk. Silakan login sebagai admin.' };
      return res.status(status).json({ pesan });
    }

    req.admin = profil;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Mengenali admin bila tokennya dikirim, tapi tetap meneruskan permintaan
 * tanpa token. Dipakai endpoint publik yang menampilkan data lebih lengkap
 * saat yang membuka adalah admin (misal harga perolehan alat).
 */
export async function kenaliAdmin(req, res, next) {
  try {
    const { profil } = await bacaAdminDariToken(req);
    req.admin = profil;
    next();
  } catch (err) {
    next(err);
  }
}
