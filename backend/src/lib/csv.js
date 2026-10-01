export const PEMISAH = ',';

/**
 * Menyusun satu sel CSV.
 *
 * Dua hal yang ditangani di sini:
 *  - tanda kutip, pemisah, dan baris baru dibungkus tanda kutip ganda;
 *  - sel yang diawali = + - @ diberi tanda kutip tunggal di depan, karena
 *    Excel dan LibreOffice memperlakukan awalan itu sebagai rumus. Tanpa
 *    ini, nama alat seperti "=Mikroskop" bisa dieksekusi saat dibuka.
 */
export function sel(nilai) {
  if (nilai === null || nilai === undefined) return '';

  let teks = String(nilai);
  if (/^[=+\-@\t\r]/.test(teks)) teks = `'${teks}`;
  if (/["\n;,]/.test(teks)) teks = `"${teks.replace(/"/g, '""')}"`;
  return teks;
}

/**
 * Merangkai berkas CSV yang terbaca benar di Excel bahasa mana pun.
 *
 * Excel tidak membaca CSV dengan pemisah tetap: ia memakai pemisah daftar
 * menurut pengaturan bahasa Windows — koma pada Windows berbahasa Inggris,
 * titik koma pada yang berbahasa Indonesia. Berkas bertitik koma yang
 * dibuka di Windows berbahasa Inggris akhirnya tampil sebagai satu kolom
 * panjang, dan sebaliknya.
 *
 * Baris "sep=," di paling atas menyelesaikan itu: Excel membacanya sebagai
 * perintah dan memakai koma, apa pun pengaturan bahasanya. Koma dipilih
 * sebagai pemisah karena itu pula yang dipahami Google Sheets dan perkakas
 * lain tanpa petunjuk tambahan.
 *
 * BOM di depan menjaga huruf beraksen tetap utuh saat dibuka di Excel.
 */
export function susunCsv(judulKolom, baris) {
  const isi = [judulKolom, ...baris]
    .map((r) => r.map(sel).join(PEMISAH))
    .join('\r\n');

  return `﻿sep=${PEMISAH}\r\n${isi}\r\n`;
}
