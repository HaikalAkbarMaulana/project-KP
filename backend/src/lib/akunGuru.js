/**
 * Aturan penyusunan akun guru.
 *
 * Guru masuk memakai NIP, bukan email. Supabase Auth mewajibkan email,
 * jadi NIP diubah menjadi alamat internal yang tidak pernah ditampilkan
 * dan tidak pernah dikirimi surat.
 *
 * PENTING: aturan yang sama ada di frontend/src/lib/akunGuru.js karena
 * halaman masuk menyusun alamat itu sendiri sebelum menghubungi Supabase.
 * Kalau salah satunya diubah, yang lain harus ikut — kalau tidak, guru
 * yang sudah terdaftar tidak akan bisa masuk lagi.
 */

/** Domain semu. Sengaja bukan domain nyata agar tidak mungkin tersurati. */
export const DOMAIN_GURU = 'guru.lokal';

/**
 * Panjang minimum NIP.
 *
 * Bukan aturan kepegawaian, melainkan batas teknis: NIP dipakai sebagai
 * kata sandi awal, dan Supabase menolak kata sandi di bawah 6 karakter.
 * Guru tanpa NIP resmi tetap bisa didaftarkan asal sekolah memberinya
 * nomor yang cukup panjang.
 */
export const MIN_PANJANG_NIP = 6;

/** Hanya angka dan huruf; spasi serta tanda baca akan merusak alamat email. */
const RE_NIP = /^[A-Za-z0-9]+$/;

export function nipSah(nip) {
  return typeof nip === 'string' && nip.length >= MIN_PANJANG_NIP && RE_NIP.test(nip);
}

/** NIP -> alamat email internal yang dipakai Supabase Auth. */
export function emailDariNip(nip) {
  return `${String(nip).trim().toLowerCase()}@${DOMAIN_GURU}`;
}
