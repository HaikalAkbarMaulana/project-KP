import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import { pembatasLaju } from './middleware/pembatasLaju.js';
import { terjemahkanGalatDatabase } from './lib/galat.js';
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

app.use(cors({
  origin(origin, callback) {
    // Permintaan tanpa header Origin (curl, aplikasi mobile, health check)
    // tidak berisiko CSRF karena API ini memakai token Bearer, bukan cookie.
    if (!origin || originDiizinkan.includes(origin)) return callback(null, true);
    callback(new Error(`Origin ${origin} tidak diizinkan.`));
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

    res.json({
      status: 'ok',
      waktu: new Date().toISOString(),
      skema: skema.siap ? 'siap' : { status: 'perlu migrasi', kolom_hilang: skema.kurang },
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
