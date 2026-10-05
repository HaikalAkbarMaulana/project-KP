import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import { pembatasLaju } from './middleware/pembatasLaju.js';
import {
  GalatAplikasi,
  terjemahkanGalatDatabase,
  karenaDatabaseTakTerjangkau,
  PESAN_DATABASE_TAK_TERJANGKAU,
  karenaDiblokirPerantara,
  PESAN_DIBLOKIR_PERANTARA,
} from './lib/galat.js';
import { periksaSkema, statusSkema } from './lib/periksaSkema.js';

import alatRoutes from './routes/alat.js';
import peminjamanRoutes from './routes/peminjaman.js';
import referensiRoutes from './routes/referensi.js';
import dashboardRoutes from './routes/dashboard.js';
import laporanRoutes from './routes/laporan.js';
import adminRoutes from './routes/admin.js';

dotenv.config();

const WAJIB_ADA = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const kurang = WAJIB_ADA.filter((nama) => !process.env[nama]);
if (kurang.length) {
  console.error(
    `Konfigurasi belum lengkap. Isi dulu di backend/.env: ${kurang.join(', ')}\n` +
    'Contoh isiannya ada di backend/.env.example.'
  );
  process.exit(1);
}

const app = express();
const modeProduksi = process.env.NODE_ENV === 'production';

// Di belakang Nginx, req.ip perlu membaca X-Forwarded-For agar pembatas
// laju menghitung per pengunjung, bukan per server proxy.
app.set('trust proxy', modeProduksi ? 1 : false);

app.use(helmet());
app.use(morgan(modeProduksi ? 'combined' : 'dev'));
app.use(express.json({ limit: '256kb' }));

// Daftar origin dipisah koma, misal:
// FRONTEND_ORIGIN=https://lab.smpn3kedungreja.sch.id,http://localhost:5173
const originDiizinkan = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Saat pengembangan, frontend bisa dibuka lewat "localhost" maupun
// "127.0.0.1" — bagi browser keduanya origin yang berbeda. Vite sengaja
// dipasang di 127.0.0.1 (lihat frontend/vite.config.js), sementara .env
// lama biasanya hanya mencantumkan localhost. Tanpa baris ini halaman bisa
// terbuka tapi seluruh datanya ditolak CORS.
if (!modeProduksi) {
  for (const o of ['http://localhost:5173', 'http://127.0.0.1:5173']) {
    if (!originDiizinkan.includes(o)) originDiizinkan.push(o);
  }
}

// Alamat jaringan lokal: 192.168.x.x, 10.x.x.x, dan 172.16-31.x.x.
const RE_JARINGAN_LOKAL =
  /^https?:\/\/(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?::\d+)?$/;

/**
 * Saat pengembangan, alamat jaringan lokal ikut diizinkan supaya aplikasi
 * bisa dibuka dari HP yang tersambung ke Wi-Fi yang sama. Alamat seperti
 * itu tidak bisa dijangkau dari internet, jadi hanya perangkat di jaringan
 * yang sama yang terpengaruh.
 *
 * Di mode produksi aturan ini mati total: yang berlaku hanya daftar di
 * FRONTEND_ORIGIN.
 */
function bolehAkses(origin) {
  if (originDiizinkan.includes(origin)) return true;
  return !modeProduksi && RE_JARINGAN_LOKAL.test(origin);
}

app.use(cors({
  origin(origin, callback) {
    // Permintaan tanpa header Origin (curl, aplikasi mobile, health check)
    // tidak berisiko CSRF karena API ini memakai token Bearer, bukan cookie.
    if (!origin || bolehAkses(origin)) return callback(null, true);

    // Dilaporkan sebagai 403 dengan pesan jelas. Sebelumnya penolakan ini
    // jatuh ke "Terjadi kesalahan pada server" yang tidak memberi petunjuk.
    console.warn(`CORS menolak origin ${origin}. Tambahkan ke FRONTEND_ORIGIN di backend/.env bila memang sah.`);
    callback(new GalatAplikasi(
      `Alamat ${origin} belum diizinkan mengakses API. Tambahkan ke FRONTEND_ORIGIN di backend/.env.`,
      403
    ));
  },
}));

// Batas longgar untuk seluruh API; endpoint publik yang menulis data
// punya batas sendiri yang lebih ketat di routes/peminjaman.js.
app.use('/api', pembatasLaju({ jendelaMs: 60_000, maks: 240 }));

app.get('/api/health', async (req, res, next) => {
  try {
    // Hasil pemeriksaan saat start bisa basi: migrasi biasanya dijalankan
    // selagi server menyala. Selama statusnya masih "belum siap", periksa
    // ulang tiap kali ditanya supaya laporannya ikut pulih sendiri begitu
    // migrasinya selesai. Setelah siap, cukup pakai hasil yang tersimpan.
    const skema = statusSkema().siap ? statusSkema() : await periksaSkema();

    let keteranganSkema = 'siap';
    if (!skema.terjangkau) keteranganSkema = 'tidak bisa diperiksa';
    else if (!skema.siap) keteranganSkema = { status: 'perlu migrasi', kolom_hilang: skema.kurang };

    res.json({
      status: 'ok',
      waktu: new Date().toISOString(),
      database: skema.terjangkau ? 'terhubung' : 'tidak terjangkau',
      skema: keteranganSkema,
    });
  } catch (err) {
    next(err);
  }
});

app.use('/api/alat', alatRoutes);
app.use('/api/peminjaman', peminjamanRoutes);
app.use('/api', referensiRoutes); // -> /api/ruangan, /api/kategori
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/laporan', laporanRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).json({ pesan: `Endpoint ${req.method} ${req.originalUrl} tidak ada.` });
});

// ------------------------------------------------------------
// Penanganan error terpusat.
//
// Hanya pesan yang memang dirancang untuk pengguna yang dikirim ke
// browser. Error lain (termasuk error mentah Supabase) dicatat di server
// dan dibalas dengan pesan umum, supaya struktur database tidak bocor.
// ------------------------------------------------------------
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  // Gangguan koneksi ke Supabase dilaporkan apa adanya (503), bukan sebagai
  // "kesalahan server" umum. Penyebabnya di luar aplikasi — biasanya
  // internet komputer server — dan petugas lab perlu tahu itu untuk bisa
  // bertindak, alih-alih mengira aplikasinya rusak.
  if (karenaDatabaseTakTerjangkau(err)) {
    console.warn(`[${req.method} ${req.originalUrl}] Supabase tidak terjangkau: ${err.message}`);
    return res.status(503).json({ pesan: PESAN_DATABASE_TAK_TERJANGKAU });
  }

  // Blokir oleh penyaring keamanan di depan Supabase. Balasannya halaman HTML,
  // bukan JSON, jadi tanpa pemeriksaan ini pengguna melihat "kesalahan server"
  // padahal yang perlu diubah adalah kata kuncinya.
  if (karenaDiblokirPerantara(err)) {
    console.warn(`[${req.method} ${req.originalUrl}] Diblokir penyaring keamanan di depan Supabase.`);
    return res.status(400).json({ pesan: PESAN_DIBLOKIR_PERANTARA });
  }

  const terjemahan = terjemahkanGalatDatabase(err);
  const galat = terjemahan || err;

  if (galat.amanDitampilkan) {
    return res.status(galat.status || 400).json({ pesan: galat.message });
  }

  console.error(`[${req.method} ${req.originalUrl}]`, err);
  res.status(err.status || 500).json({
    pesan: 'Terjadi kesalahan pada server. Silakan coba lagi atau hubungi pengelola.',
  });
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`API berjalan di http://localhost:${PORT}`);
  // Sengaja tidak ditunggu: server tetap menyala walau pemeriksaan gagal,
  // supaya masalah koneksi tidak ikut menghalangi start.
  periksaSkema().catch((err) => console.warn('Pemeriksaan skema dilewati:', err.message));
});
