import { GalatAplikasi } from '../lib/galat.js';

/**
 * Pembatas laju permintaan sederhana berbasis memori.
 *
 * Dibuat tanpa dependensi tambahan, dan itu menentukan sejauh mana ia
 * bisa diandalkan. Hitungannya ada di memori proses, sedangkan backend
 * sekarang berjalan di Vercel sebagai fungsi serverless: beberapa permintaan
 * yang datang beruntun biasanya dilayani instance yang sama -- dan untuk itu
 * pembatas ini bekerja, sudah diuji 20 lolos lalu 20 ditolak -- tetapi
 * instance baru selalu mulai dari nol, sehingga batas sebenarnya bisa lebih
 * longgar daripada angka yang tertulis.
 *
 * Yang dicegah: satu orang menekan tombol berulang kali atau mencoba menebak
 * kode peminjaman dalam satu rentetan. Yang tidak dicegah: percobaan yang
 * sengaja diperlambat atau disebar. Untuk inventaris SMP, yang bocor paling
 * jauh adalah nama peminjam yang sudah disamarkan, jadi batas ini memadai.
 * Bila suatu saat perlu lebih ketat, ganti dengan penyimpanan bersama
 * (misalnya Upstash Redis) supaya hitungannya satu untuk semua instance.
 */
export function pembatasLaju({ jendelaMs = 60_000, maks = 60, pesan } = {}) {
  const jejak = new Map();

  // Bersihkan entri kedaluwarsa berkala supaya Map tidak tumbuh terus.
  const pembersih = setInterval(() => {
    const sekarang = Date.now();
    for (const [kunci, data] of jejak) {
      if (data.resetPada <= sekarang) jejak.delete(kunci);
    }
  }, jendelaMs);
  pembersih.unref?.();

  return function batasi(req, res, next) {
    const kunci = req.ip || req.socket.remoteAddress || 'tak-dikenal';
    const sekarang = Date.now();
    const data = jejak.get(kunci);

    if (!data || data.resetPada <= sekarang) {
      jejak.set(kunci, { jumlah: 1, resetPada: sekarang + jendelaMs });
      return next();
    }

    data.jumlah += 1;
    if (data.jumlah > maks) {
      const detik = Math.ceil((data.resetPada - sekarang) / 1000);
      res.set('Retry-After', String(detik));
      return next(
        new GalatAplikasi(
          pesan || `Terlalu banyak permintaan. Coba lagi dalam ${detik} detik.`,
          429
        )
      );
    }

    next();
  };
}
