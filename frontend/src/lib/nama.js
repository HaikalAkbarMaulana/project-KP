/**
 * Menyingkat nama untuk ditampilkan di bar atas.
 *
 * Nama guru hampir selalu panjang karena membawa gelar —
 * "Rina Kusumawati, S.Pd." tidak muat di sebelah menu tanpa mendesaknya,
 * apalagi di layar ponsel. Nama lengkapnya tetap ditampilkan utuh di dalam
 * menu turun, jadi penyingkatan di sini tidak menghilangkan informasi.
 *
 *   "Rina Kusumawati, S.Pd."        -> "Rina K."
 *   "Haikal Akbar Maulana"          -> "Haikal A. M."
 *   "Budi Santoso"                  -> "Budi S."
 *   "Suparno"                       -> "Suparno"
 *   "Dr. H. Ahmad Fauzi, M.Pd."     -> "Ahmad F."
 */

/**
 * Gelar yang ditulis di DEPAN nama.
 *
 * Tanpa daftar ini, "Dr. H. Ahmad Fauzi" tersingkat menjadi "Dr. H. A." —
 * gelarnya yang ditampilkan, namanya justru hilang. Gelar belakang tidak
 * perlu didaftar karena selalu dipisahkan koma.
 */
const GELAR_DEPAN = new Set(['dr', 'drs', 'dra', 'ir', 'h', 'hj', 'prof', 'kh', 'sdr', 'sdri']);

export function singkatNama(nama) {
  if (!nama) return '';

  // Gelar belakang ditulis setelah koma dan bukan bagian dari nama panggilan.
  const tanpaGelar = String(nama).split(',')[0].trim();
  const kata = tanpaGelar
    .split(/\s+/)
    .filter(Boolean)
    .filter((k, i, semua) => {
      // Gelar depan dibuang, tapi jangan sampai seluruh namanya habis —
      // kalau seseorang memang bernama "Hj" saja, biarkan apa adanya.
      const bersih = k.replace(/\./g, '').toLowerCase();
      if (!GELAR_DEPAN.has(bersih)) return true;
      return semua.slice(i + 1).every((sisa) => GELAR_DEPAN.has(sisa.replace(/\./g, '').toLowerCase()));
    });

  if (kata.length === 0) return '';
  if (kata.length === 1) return kata[0];

  // Nama depan ditulis utuh, sisanya cukup inisial. Dibatasi dua inisial
  // supaya nama yang terdiri dari banyak kata tidak kembali memanjang.
  const inisial = kata.slice(1, 3).map((k) => `${k[0].toUpperCase()}.`);
  return [kata[0], ...inisial].join(' ');
}
