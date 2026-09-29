# Sistem Inventaris & Peminjaman Alat Lab — SMPN 3 Kedungreja

Aplikasi pendataan inventaris lab komputer & IPA untuk SMP, lengkap dengan alur
peminjaman alat oleh guru.

**Login hanya untuk admin/petugas lab.** Guru tidak perlu membuat akun: mereka
melihat katalog dan mengajukan peminjaman lewat halaman publik, lalu memantau
statusnya memakai kode pengajuan.

**Stack:** React + Vite + Tailwind CSS (frontend) · Node.js + Express (backend API) ·
Supabase/PostgreSQL (database & autentikasi)

---

## Alur Penggunaan

| Siapa | Bisa apa | Perlu akun? |
| --- | --- | --- |
| **Siapa saja** | Melihat katalog alat, stok, dan ketersediaan di `/` | Tidak |
| **Guru** | Mengajukan peminjaman dari halaman detail alat; melacak status di `/lacak` dengan kode `PJM-…` | Tidak |
| **Admin / petugas lab** | Seluruh panel `/admin`: dashboard, inventaris, persetujuan peminjaman, ruangan, kategori, akun admin | Ya |

Alur satu peminjaman:

```
Guru mengisi form  →  pending
                          │  admin menyetujui  →  disetujui   (stok ditahan)
                          │  admin menolak     →  ditolak
                                     │
                                     ├─ admin menandai diambil  →  dipinjam
                                     └─ admin membatalkan       →  dibatalkan (stok dilepas)
                                                 │
                                                 └─ admin mencatat kembali → dikembalikan (stok dilepas)
```

---

## Cara Cepat Menjalankan (Windows)

Setelah Supabase dan kedua berkas `.env` siap (lihat langkah 1–3 di bawah):

| Berkas | Fungsi |
| --- | --- |
| **`jalankan-web.bat`** | Klik dua kali. Menyalakan backend dan frontend di dua jendela terpisah, lalu membuka browser. Dependensi dipasang otomatis saat pertama kali. |
| **`hentikan-web.bat`** | Klik dua kali untuk mematikan keduanya. Pakai juga bila muncul error `EADDRINUSE` / port sudah dipakai. |

`jalankan-web.bat` aman diklik berulang: server yang sudah menyala tidak dinyalakan
dua kali. Selama aplikasi dipakai, jendela **LabPinjam - Backend** dan
**LabPinjam - Frontend** harus tetap terbuka.

---

## Struktur Proyek

```
peminjaman-alat-lab/
├── database/
│   ├── schema.sql                    # Skema lengkap — jalankan di Supabase SQL Editor
│   └── migrasi/001-admin-saja.sql    # Hanya untuk database lama yang sudah berisi data
├── backend/                          # API Express
│   ├── scripts/buat-admin.js         # Membuat akun admin pertama
│   └── src/
│       ├── index.js                  # Konfigurasi server, CORS, penanganan error
│       ├── lib/                      # galat, validasi, log aktivitas
│       ├── middleware/               # auth admin, pembatas laju
│       └── routes/                   # alat, peminjaman, referensi, dashboard, laporan, admin
└── frontend/                         # Aplikasi React
    └── src/
        ├── pages/public/             # Beranda, Detail Alat, Lacak Pengajuan
        ├── pages/admin/              # Masuk, Dashboard, Inventaris, Peminjaman, Ruangan, Kategori, Akun
        ├── components/               # Layout, modal, tabel, keadaan muat/galat
        ├── hooks/                    # pengambilan data & penundaan pencarian
        └── context/AuthContext.jsx
```

---

## 1. Menyiapkan Supabase

1. Buat proyek baru di [supabase.com](https://supabase.com).
2. Buka **SQL Editor**, tempel seluruh isi `database/schema.sql`, lalu jalankan.
3. Catat **Project URL**, **anon public key**, dan **service_role key** dari
   **Project Settings → API**.

> **Keamanan:** `service_role key` melewati seluruh aturan RLS di database.
> Kunci itu hanya boleh berada di `backend/.env`, tidak pernah di frontend.

### Sudah punya database dari versi sebelumnya?

Versi lama masih mengenal akun guru dan menyimpan stok dengan cara berbeda.
Jalankan `database/migrasi/001-admin-saja.sql` lebih dulu, lalu ikuti langkah
lanjutan yang tertulis di bagian bawah berkas itu. **Buat backup dulu** — migrasi
ini menghapus seluruh akun guru.

---

## 2. Menjalankan Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Isi `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` di `.env` sebelum menjalankan —
server menolak start bila keduanya kosong. Backend berjalan di `http://localhost:4000`.

### Membuat akun admin pertama

```bash
cd backend
npm run buat-admin
```

Skrip akan menanyakan email, nama, jabatan, dan kata sandi. Admin berikutnya
tidak perlu skrip ini — tambahkan lewat menu **Akun Admin** di dalam panel.

### Lupa kata sandi admin

```bash
cd backend
npm run ganti-sandi
```

Kata sandi lama tidak bisa dibaca dari mana pun — Supabase menyimpannya sebagai
hash bcrypt, dan hash memang dirancang agar tidak bisa dikembalikan ke teks
aslinya. Skrip di atas menimpanya dengan yang baru. Alternatifnya lewat
**Supabase Dashboard → Authentication → Users → ⋯ → Reset password**.

---

## 3. Menjalankan Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend berjalan di `http://127.0.0.1:5173`. Masuk sebagai admin lewat
`/admin/masuk` (tautannya juga ada di footer halaman publik).

---

## Yang Ada di Panel Admin

- **Dashboard** — jumlah unit layak pakai / rusak / dipinjam, nilai aset, grafik
  peminjaman 6 bulan terakhir, alat paling sering dipinjam, dan dua kartu peringatan:
  pengajuan yang menunggu ditinjau serta alat yang terlambat dikembalikan.
- **Data Inventaris** — CRUD alat beserta kolom administrasi Buku Inventaris Barang
  (merk/tipe, nomor seri, tahun perolehan, sumber dana, harga satuan). Alat yang
  tidak dipinjamkan keluar bisa ditandai lewat sakelar *boleh dipinjam*.
- **Foto alat** — diunggah langsung dari formulir tambah/edit alat ke Supabase
  Storage, lalu tampil di katalog dan halaman detail. Maksimal 2 MB, format JPG,
  PNG, atau WEBP. Batas itu dipasang di tingkat bucket sehingga dipaksakan
  Supabase, bukan sekadar diperiksa di browser. Foto lama dibersihkan otomatis
  saat diganti atau saat alatnya dihapus.
- **Hapus data peminjaman** — untuk kiriman iseng, dobel, atau salah isi. Form
  pengajuan terbuka untuk umum, jadi data semacam itu pasti muncul. Tombolnya
  terkunci selama pengajuan masih menahan stok (status *disetujui* atau
  *dipinjam*): menghapusnya akan melepas stok padahal alatnya masih di tangan
  guru. Catat pengembaliannya atau batalkan dulu.
- **Peminjaman** — tinjau, setujui/tolak dengan catatan, tandai diambil, catat
  pengembalian. Ada penyaring khusus untuk yang terlambat, dan nomor HP guru bisa
  langsung ditelepon.
- **Ruangan & Kategori** — data master.
- **Akun Admin** — daftarkan petugas lab lain, nonaktifkan aksesnya, atau hapus.
- **Unduh CSV** di halaman Inventaris dan Peminjaman, siap dibuka di Excel
  (pemisah titik koma, sudah ber-BOM UTF-8).

---

## Cara Kerja Stok

Kolom pada tabel `alat` sengaja dipisah supaya angkanya tidak pernah melenceng:

| Kolom | Diisi oleh | Arti |
| --- | --- | --- |
| `jumlah_baik` | Admin | Unit layak pakai |
| `jumlah_rusak` | Admin | Unit tidak layak pakai |
| `jumlah_dipinjam` | Trigger database | Unit yang sedang keluar |
| `jumlah_total` | PostgreSQL | `jumlah_baik + jumlah_rusak` |
| `jumlah_tersedia` | PostgreSQL | `jumlah_baik - jumlah_dipinjam` |

`jumlah_total` dan `jumlah_tersedia` adalah *generated column* — tidak bisa ditulis
siapa pun, jadi tidak mungkin berbeda dari kenyataan. `jumlah_dipinjam` dijaga
trigger `trg_sinkron_stok`, dan constraint `cek_dipinjam_wajar` menjadi pengaman
terakhir agar persetujuan berlebih tidak membuat stok minus.

Kalau suatu saat angkanya terlanjur diutak-atik manual, hitung ulang dengan:

```sql
select public.hitung_ulang_stok();
```

---

## Catatan Keamanan

- Satu-satunya jalan masuk adalah akun yang punya baris **aktif** di tabel `profil`.
  Punya akun di Supabase Auth saja tidak cukup.
- Backend memvalidasi seluruh masukan dan hanya menulis kolom yang memang boleh
  diubah klien — badan permintaan tidak pernah diteruskan mentah ke database.
- Endpoint publik dibatasi lajunya: 10 pengajuan per jam per alamat IP, dan 20
  pelacakan kode per menit. Pembatas ini disimpan di memori satu proses; bila nanti
  backend dijalankan sebagai cluster, ganti dengan `express-rate-limit` + Redis.
- Halaman pelacakan hanya menampilkan sebagian nama peminjam dan tidak pernah
  mengirim nomor HP, karena kode peminjaman bisa saja dicoba-coba orang lain.
- Pesan error mentah dari database tidak diteruskan ke browser.
- Data peminjaman memuat nama dan nomor HP guru. Tabel itu tertutup di level RLS
  dan hanya bisa dibaca lewat backend oleh admin.

---

## Yang Belum Dibuat

- **Notifikasi WhatsApp/email** saat pengajuan diproses.
- **Ekspor PDF** (CSV sudah tersedia).
- **Ganti kata sandi sendiri** dari dalam panel — saat ini lewat Supabase Dashboard.

---

## Deploy ke Server Sekolah

```bash
# Frontend
cd frontend && npm run build        # menghasilkan dist/, sajikan lewat Nginx

# Backend
cd backend && NODE_ENV=production pm2 start src/index.js --name lab-api
```

Sajikan `dist/` sebagai berkas statis dan arahkan semua rute ke `index.html`
(aplikasi ini memakai *client-side routing*):

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

Isi `FRONTEND_ORIGIN` di `backend/.env` dengan domain sebenarnya, dan setel
`NODE_ENV=production` agar backend membaca `X-Forwarded-For` dari Nginx —
tanpa itu pembatas laju akan menghitung seluruh pengunjung sebagai satu orang.
