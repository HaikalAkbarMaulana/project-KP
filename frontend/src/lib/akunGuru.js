/**
 * Aturan penyusunan akun guru — salinan sisi browser.
 *
 * Guru masuk memakai NIP, sedangkan Supabase Auth mewajibkan email. Halaman
 * masuk menyusun sendiri alamat internalnya sebelum menghubungi Supabase,
 * jadi aturannya harus persis sama dengan backend.
 *
 * PENTING: pasangannya ada di backend/src/lib/akunGuru.js. Kalau salah
 * satunya diubah, yang lain harus ikut — kalau tidak, guru yang sudah
 * terdaftar tidak akan bisa masuk lagi.
 */

export const DOMAIN_GURU = 'guru.lokal';

/** NIP -> alamat email internal yang dipakai Supabase Auth. */
export function emailDariNip(nip) {
  return `${String(nip).trim().toLowerCase()}@${DOMAIN_GURU}`;
}

/**
 * Mengubah apa pun yang diketik di kotak "NIP atau email" menjadi alamat
 * yang dimengerti Supabase.
 *
 * Petugas lab masuk dengan email, guru dengan NIP. Keduanya memakai satu
 * kotak isian supaya tidak ada yang perlu memilih "saya ini yang mana".
 */
export function keEmailMasuk(identitas) {
  const bersih = String(identitas).trim();
  return bersih.includes('@') ? bersih.toLowerCase() : emailDariNip(bersih);
}
