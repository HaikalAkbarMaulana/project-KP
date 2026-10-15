import { supabaseAdmin } from '../supabaseClient.js';
import {
  GalatAplikasi,
  karenaDatabaseTakTerjangkau,
  PESAN_DATABASE_TAK_TERJANGKAU,
} from '../lib/galat.js';
import { karenaKolomHilang, PESAN_SKEMA_LAMA } from '../lib/periksaSkema.js';

/**
 * Mengambil profil pengguna dari token Authorization, bila ada.
 *
 * Aplikasi mengenal dua peran: 'admin' (petugas lab) dan 'guru'. Keduanya
 * memakai Supabase Auth yang sama; yang membedakan hanya kolom `peran` di
 * tabel profil. Punya akun di Supabase Auth saja tidak pernah cukup — harus
 * ada baris aktif di `profil`.
 *
 * Mengembalikan objek { profil, galat } — `galat` berisi pesan siap tampil
 * kalau tokennya ada tapi tidak sah.
 */
async function bacaProfilDariToken(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) return { profil: null, galat: null };

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

  // Supabase yang tidak terjangkau jangan dilaporkan sebagai "sesi tidak
  // valid" — itu akan membuat pengguna mengira harus login ulang, padahal
  // masalahnya koneksi internet server.
  if (karenaDatabaseTakTerjangkau(userError)) {
    throw new GalatAplikasi(PESAN_DATABASE_TAK_TERJANGKAU, 503);
  }

  if (userError || !userData?.user) {
    return { profil: null, galat: { status: 401, pesan: 'Sesi tidak valid atau sudah kedaluwarsa. Silakan masuk lagi.' } };
  }

  const { data: profil, error: profilError } = await supabaseAdmin
    .from('profil')
    .select('id, nama, email, jabatan, no_hp, aktif, peran, nip, mapel, harus_ganti_sandi')
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
        pesan: 'Akun ini belum terdaftar di aplikasi. Hubungi petugas lab untuk didaftarkan.',
      },
    };
  }

  if (!profil.aktif) {
    return { profil: null, galat: { status: 403, pesan: 'Akun Anda dinonaktifkan. Hubungi petugas lab.' } };
  }

  return { profil, galat: null };
}

/**
 * Membuat middleware yang mewajibkan sesi dengan peran tertentu.
 *
 * `peranDiizinkan` kosong berarti semua peran boleh, asalkan sudah masuk.
 * `bolehBelumGantiSandi` hanya dipakai endpoint ganti sandi itu sendiri —
 * semua endpoint lain tertutup sampai kata sandi awal diganti.
 */
function wajibPeran(peranDiizinkan, pesanSalahPeran, { bolehBelumGantiSandi = false } = {}) {
  return async function periksa(req, res, next) {
    try {
      const { profil, galat } = await bacaProfilDariToken(req);

      if (!profil) {
        const { status, pesan } = galat || { status: 401, pesan: 'Anda belum masuk. Silakan login dulu.' };
        return res.status(status).json({ pesan });
      }

      if (peranDiizinkan.length && !peranDiizinkan.includes(profil.peran)) {
        return res.status(403).json({ pesan: pesanSalahPeran });
      }

      // Selama kata sandi awal belum diganti, satu-satunya yang boleh
      // dilakukan adalah menggantinya. Penjagaan ini ada di server, bukan
      // cuma di browser: tanpa itu, akun yang kata sandinya masih NIP —
      // yang gampang ditebak — tetap bisa dipakai penuh hanya dengan
      // melewati layar ganti sandi.
      if (profil.harus_ganti_sandi && !bolehBelumGantiSandi) {
        return res.status(403).json({
          pesan: 'Ganti kata sandi Anda dulu sebelum memakai aplikasi.',
          kode: 'WAJIB_GANTI_SANDI',
        });
      }

      req.pengguna = profil;
      // Nama lama dipertahankan supaya rute admin yang sudah ada tidak
      // perlu diubah serentak.
      req.admin = profil.peran === 'admin' ? profil : null;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Wajib masuk sebagai admin/petugas lab. */
export const wajibAdmin = wajibPeran(
  ['admin'],
  'Halaman ini hanya untuk petugas lab.'
);

/** Wajib masuk sebagai guru. */
export const wajibGuru = wajibPeran(
  ['guru'],
  'Halaman ini hanya untuk guru. Petugas lab memakai panel admin.'
);

/**
 * Wajib masuk, peran apa pun, dan tetap boleh dipakai walau kata sandi
 * awal belum diganti. Khusus untuk endpoint ganti sandi — kalau endpoint
 * itu ikut diblokir, akun yang wajib ganti sandi tidak akan pernah bisa.
 */
export const wajibMasuk = wajibPeran([], '', { bolehBelumGantiSandi: true });

/**
 * Mengenali pengguna bila tokennya dikirim, tapi tetap meneruskan
 * permintaan tanpa token. Dipakai endpoint publik yang menampilkan data
 * lebih lengkap saat yang membuka adalah admin (misal harga perolehan
 * alat), dan katalog yang menampilkan tombol ajukan hanya untuk guru.
 */
export async function kenaliPengguna(req, res, next) {
  try {
    const { profil } = await bacaProfilDariToken(req);
    req.pengguna = profil;
    req.admin = profil?.peran === 'admin' ? profil : null;
    next();
  } catch (err) {
    next(err);
  }
}

// Nama lama, dipakai rute alat. Dipertahankan agar tidak perlu mengubah
// seluruh berkas sekaligus.
export { kenaliPengguna as kenaliAdmin };
