/**
 * Sifat tambahan untuk kolom isian bertipe angka.
 *
 * Kolom <input type="number"> sebenarnya sudah bisa diketik, tetapi ada dua
 * perilaku bawaan peramban yang membuatnya terasa menyusahkan:
 *
 *  1. Mengklik kolom hanya menaruh kursor di sela angka yang sudah ada.
 *     Untuk mengganti "1" menjadi "148", isinya harus dihapus lebih dulu;
 *     kalau langsung diketik, yang muncul justru "1148". Orang lalu memilih
 *     menekan tombol panah berkali-kali karena terasa lebih aman, padahal
 *     untuk angka seperti 148 itu melelahkan.
 *
 *  2. Memutar roda tetikus di atas kolom yang sedang disorot akan mengubah
 *     angkanya. Pada formulir panjang yang perlu digulir, angka bisa berubah
 *     tanpa disadari, dan jumlah unit yang keliru baru ketahuan belakangan.
 *
 * Keduanya diperbaiki di sini: mengklik langsung menyorot seluruh angka
 * sehingga tinggal diketik timpa, dan memutar roda melepas sorotan sehingga
 * angkanya tidak ikut berubah.
 *
 * Tanda panah naik-turunnya sendiri disembunyikan lewat aturan gaya pada
 * index.css, supaya kolom angka tampak sama dengan kolom isian lain.
 *
 * Pemakaian:
 *
 *   <input type="number" {...ISIAN_ANGKA} value={...} onChange={...} />
 */
export const ISIAN_ANGKA = {
  onFocus: (e) => e.currentTarget.select(),
  onWheel: (e) => e.currentTarget.blur(),
};
