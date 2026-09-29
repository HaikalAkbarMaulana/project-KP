import { supabaseAdmin } from '../supabaseClient.js';

export const BUCKET_FOTO = 'foto-alat';

const PENANDA_PUBLIK = `/storage/v1/object/public/${BUCKET_FOTO}/`;

/**
 * Mengambil nama berkas dari URL publik Supabase Storage.
 *
 * Mengembalikan null untuk URL dari tempat lain. Kolom foto_url boleh diisi
 * tautan luar, dan berkas milik orang lain jelas tidak boleh kita hapus.
 */
export function jalurDariUrl(url) {
  if (typeof url !== 'string') return null;
  const posisi = url.indexOf(PENANDA_PUBLIK);
  if (posisi === -1) return null;

  const jalur = url.slice(posisi + PENANDA_PUBLIK.length).split('?')[0];
  return jalur || null;
}

/**
 * Menghapus foto alat dari penyimpanan.
 *
 * Kegagalan hanya dicatat di konsol: pembersihan berkas tidak boleh
 * menggagalkan penghapusan data alat yang sudah terlanjur berhasil.
 */
export async function hapusFotoAlat(url) {
  const jalur = jalurDariUrl(url);
  if (!jalur) return;

  const { error } = await supabaseAdmin.storage.from(BUCKET_FOTO).remove([jalur]);
  if (error) console.warn(`Gagal menghapus foto ${jalur}: ${error.message}`);
}
