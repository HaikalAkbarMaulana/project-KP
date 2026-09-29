import { supabase } from './supabaseClient';

export const BUCKET_FOTO = 'foto-alat';
export const BATAS_UKURAN_MB = 2;

const JENIS_DIIZINKAN = ['image/jpeg', 'image/png', 'image/webp'];
const BATAS_UKURAN_BYTE = BATAS_UKURAN_MB * 1024 * 1024;

// Penanda di dalam URL publik Supabase Storage.
const PENANDA_PUBLIK = `/storage/v1/object/public/${BUCKET_FOTO}/`;

/**
 * Memeriksa berkas sebelum diunggah.
 *
 * Batas yang sama juga dipasang di tingkat bucket Supabase, jadi berkas
 * yang melanggar tetap ditolak walau pemeriksaan ini dilewati. Gunanya di
 * sini semata agar petugas lab langsung tahu masalahnya tanpa menunggu
 * unggahan gagal di tengah jalan.
 */
export function periksaBerkasFoto(berkas) {
  if (!JENIS_DIIZINKAN.includes(berkas.type)) {
    throw new Error('Format foto harus JPG, PNG, atau WEBP.');
  }
  if (berkas.size > BATAS_UKURAN_BYTE) {
    const ukuran = (berkas.size / 1024 / 1024).toFixed(1);
    throw new Error(`Ukuran foto ${ukuran} MB, melebihi batas ${BATAS_UKURAN_MB} MB. Perkecil dulu fotonya.`);
  }
}

function namaAcak(berkas) {
  const ekstensi = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[berkas.type] || 'jpg';
  const acak = crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${acak}.${ekstensi}`;
}

/** Mengunggah foto alat, mengembalikan URL publiknya. */
export async function unggahFotoAlat(berkas) {
  periksaBerkasFoto(berkas);

  const nama = namaAcak(berkas);
  const { error } = await supabase.storage
    .from(BUCKET_FOTO)
    .upload(nama, berkas, { contentType: berkas.type, upsert: false });

  if (error) {
    // Pesan bawaan Supabase berbahasa Inggris dan sering tidak jelas bagi
    // petugas lab, jadi kasus yang paling sering diterjemahkan di sini.
    const pesan = error.message || '';
    if (/exceeded the maximum allowed size|Payload too large/i.test(pesan)) {
      throw new Error(`Foto terlalu besar. Batas ${BATAS_UKURAN_MB} MB.`);
    }
    if (/mime type|not allowed/i.test(pesan)) {
      throw new Error('Format foto harus JPG, PNG, atau WEBP.');
    }
    if (/Bucket not found/i.test(pesan)) {
      throw new Error('Penyimpanan foto belum disiapkan di Supabase. Jalankan bagian penyimpanan di database/schema.sql.');
    }
    if (/row-level security|Unauthorized|JWT/i.test(pesan)) {
      throw new Error('Sesi Anda sudah kedaluwarsa. Masuk ulang lalu coba lagi.');
    }
    throw new Error(`Gagal mengunggah foto: ${pesan}`);
  }

  const { data } = supabase.storage.from(BUCKET_FOTO).getPublicUrl(nama);
  return data.publicUrl;
}

/**
 * Menghapus foto yang sudah tidak dipakai.
 *
 * Sengaja tidak melempar error: kegagalan membersihkan berkas lama tidak
 * boleh menggagalkan penyimpanan data alat. Paling buruk berkasnya
 * tertinggal di penyimpanan tanpa merusak apa pun.
 */
export async function hapusFotoAlat(url) {
  const jalur = jalurDariUrl(url);
  if (!jalur) return;

  const { error } = await supabase.storage.from(BUCKET_FOTO).remove([jalur]);
  if (error) console.warn('Gagal menghapus foto lama:', error.message);
}

/**
 * Mengambil nama berkas dari URL publik.
 *
 * Mengembalikan null untuk URL dari tempat lain — foto_url boleh saja diisi
 * tautan luar, dan yang seperti itu tentu tidak boleh kita coba hapus.
 */
export function jalurDariUrl(url) {
  if (typeof url !== 'string') return null;
  const posisi = url.indexOf(PENANDA_PUBLIK);
  if (posisi === -1) return null;

  const jalur = url.slice(posisi + PENANDA_PUBLIK.length).split('?')[0];
  return jalur || null;
}
