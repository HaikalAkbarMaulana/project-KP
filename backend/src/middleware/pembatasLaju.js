import { GalatAplikasi } from '../lib/galat.js';

/**
 * Pembatas laju permintaan sederhana berbasis memori.
 *
 * Dibuat tanpa dependensi tambahan karena aplikasi ini dijalankan sebagai
 * satu proses di server sekolah. Konsekuensinya: hitungan direset saat
 * server restart, dan kalau suatu saat backend dijalankan multi-proses
 * (pm2 cluster) tiap proses punya hitungan sendiri. Untuk skala SMP hal
 * itu masih memadai; bila nanti perlu lebih ketat, ganti dengan
 * express-rate-limit + penyimpanan Redis.
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
