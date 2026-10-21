# Sistem Inventaris & Peminjaman Alat Lab — SMPN 3 Kedungreja

Aplikasi pendataan inventaris lab komputer & IPA untuk SMP, lengkap dengan alur
peminjaman alat oleh guru.

**Guru dan petugas lab sama-sama punya akun.** Guru masuk memakai **NIP**
(kata sandi awalnya NIP sendiri, wajib diganti saat pertama masuk), petugas lab
memakai email. Keduanya lewat satu halaman `/masuk`. Katalog alat tetap terbuka
untuk umum; yang menuntut akun hanya pengajuan peminjamannya.

**Stack:** React + Vite + Tailwind CSS (frontend) · Node.js + Express (backend API) ·
Supabase/PostgreSQL (database & autentikasi)

---

## Alur Penggunaan

| Siapa | Bisa apa | Perlu akun? |
| --- | --- | --- |
| **Siapa saja** | Melihat katalog alat, stok, dan ketersediaan di `/` | Tidak |
| **Guru** | Mengajukan peminjaman dari halaman detail alat, lalu memantau & membatalkannya di `/guru/peminjaman` | Ya — masuk dengan NIP |
| **Admin / petugas lab** | Seluruh panel `/admin`: dashboard, inventaris, persetujuan peminjaman, ruangan, kategori, akun admin & guru | Ya — masuk dengan email |

Akun guru **tidak** didaftarkan sendiri oleh gurunya: petugas lab yang
membuatkannya. Tidak ada email sama sekali dalam alurnya — lupa kata sandi
diselesaikan dengan reset oleh petugas lab, bukan lewat surel.

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
| **`jalankan-web.bat`** | Klik dua kali. Menyalakan backend dan frontend di dua jendela terpisah, membuka browser, lalu menampilkan dua alamat sekaligus: untuk laptop ini dan untuk dibuka dari HP di Wi-Fi yang sama. Dependensi dipasang otomatis saat pertama kali. |
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

### Mendaftarkan guru

Cara utamanya lewat panel admin: menu **Akun Guru** → **Impor Excel**. Unduh
templatnya, isi, lalu unggah; hasilnya dilaporkan per baris sehingga satu baris
salah tidak menggagalkan sisanya. Baris yang NIP-nya sudah terdaftar dilewati,
jadi berkas yang sama aman diunggah ulang setelah dibetulkan.

> **Isi NIP lewat templat yang disediakan.** Excel memperlakukan sel angka
> sebagai bilangan, dan bilangan hanya teliti sampai 15 angka berarti —
> sedangkan NIP punya 18. NIP yang diketik di sel biasa sudah berubah
> (`…012005` menjadi `…012000`) sebelum aplikasi sempat membacanya. Kolom NIP
> pada templat sudah berformat Teks, dan aplikasi menolak mengimpor berkas yang
> NIP-nya terlanjur rusak alih-alih diam-diam membuat akun yang tak bisa dipakai.

Untuk satu-dua guru, tersedia juga skrip terminal:

```bash
npm --prefix backend run buat-guru
```

Skrip menanyakan NIP, nama, mata pelajaran, dan nomor HP. Kata sandi awalnya
NIP itu sendiri, dan akunnya ditandai wajib berganti kata sandi saat pertama
kali masuk — NIP tercetak di dokumen kepegawaian dan ikut tampil di daftar
peminjaman, jadi ia tidak boleh bertahan sebagai kata sandi.

Guru tanpa NIP resmi tetap bisa didaftarkan: isi NUPTK, atau nomor lain yang
ditetapkan sekolah, minimal 6 karakter.

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

`npm run dev` mencetak dua macam alamat sekaligus:

```
➜  Local:   http://localhost:5173/        <- dibuka di laptop ini
➜  Network: http://10.62.39.188:5173/     <- dibuka dari HP di Wi-Fi yang sama
```

Alamat `Network` berubah setiap kali laptop berpindah Wi-Fi, jadi baca ulang dari
terminal alih-alih menghafalnya. Bila muncul lebih dari satu baris `Network`,
pakai yang seangka dengan Wi-Fi laptop (`192.168.56.x` biasanya milik
VirtualBox/VMware dan tidak bisa dibuka dari HP).

Masuk lewat `/masuk` — satu halaman untuk kedua peran. Guru memakai NIP,
petugas lab memakai email. Tombolnya ada di pojok kanan atas halaman publik.

> `vite.config.js` hanya dibaca saat server dinyalakan. Setelah berkas itu
> diubah, hentikan `npm run dev` dengan `Ctrl+C` lalu jalankan lagi — menyimpan
> saja tidak cukup.

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
  (pemisah koma, diawali baris `sep=,` dan BOM UTF-8 sehingga kolomnya
  terpisah benar di Excel berbahasa Inggris maupun Indonesia).

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

## Aplikasi yang Sudah Online

| | Alamat |
| --- | --- |
| **Situs** | https://inventaris-web-beige.vercel.app |
| **API** | https://inventaris-api.vercel.app |
| Cek kesehatan API | https://inventaris-api.vercel.app/api/health |

Keduanya proyek Vercel terpisah dari repo yang sama — `inventaris-web`
(root `frontend`) dan `inventaris-api` (root `backend`).

Menerbitkan ulang setelah ada perubahan:

```bash
cd frontend && npx vercel deploy --prod    # setelah mengubah frontend
cd backend  && npx vercel deploy --prod    # setelah mengubah backend
```

> **Variabel `VITE_*` dipanggang saat build.** Mengubahnya di dashboard tidak
> berpengaruh sampai proyek frontend di-deploy ulang.

> **Mengubah `FRONTEND_ORIGIN`** mengharuskan backend di-deploy ulang juga.

---

## Cara Deploy dari Nol (Vercel)

Supaya bisa dibuka siapa pun tanpa harus berada di Wi-Fi sekolah. Gratis, dan
menerbitkan ulang otomatis setiap kali ada `git push`.

Aplikasi ini dua bagian, jadi dibuat **dua proyek Vercel dari repo yang sama**.
Masing-masing memakai `package.json` sendiri, sehingga daftar dependensinya
tidak perlu diduplikasi.

| Proyek | Root Directory | Jadi |
| --- | --- | --- |
| Frontend | `frontend` | Situs yang dibuka pengguna |
| Backend | `backend` | API, dijalankan sebagai *serverless function* |

### 1. Backend

1. vercel.com → **Add New → Project** → pilih repo ini
2. **Root Directory**: `backend`
3. Isi tiga variabel lingkungan:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NODE_ENV` = `production`
   - `FRONTEND_ORIGIN` → diisi belakangan, setelah alamat frontend diketahui
4. Deploy, lalu catat alamatnya, misal `https://labpinjam-api.vercel.app`
5. Pastikan hidup dengan membuka `https://ALAMAT-ANDA.vercel.app/api/health` —
   balasannya harus menyebut `database: terhubung` dan `skema: siap`

`backend/vercel.json` mengarahkan seluruh permintaan ke `api/index.js`, yang
memuat aplikasi Express yang sama persis dengan yang dipakai saat dijalankan
di komputer sendiri. Jadi tidak ada risiko perilaku berbeda antara yang diuji
dan yang online.

### 2. Frontend

1. **Add New → Project** → repo yang sama lagi
2. **Root Directory**: `frontend`
3. Isi tiga variabel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_API_BASE_URL` → alamat backend tadi **ditambah** `/api`,
     misal `https://labpinjam-api.vercel.app/api`
4. Deploy

`frontend/vercel.json` mengarahkan semua rute ke `index.html`. Tanpa itu,
menyegarkan halaman di `/admin/peminjaman` berakhir 404 — karena rutenya hanya
ada di browser, bukan di server.

> **Variabel `VITE_*` dipanggang saat build.** Mengubahnya tidak berpengaruh
> sampai proyek frontend di-deploy ulang.

### 3. Sambungkan keduanya

Kembali ke proyek backend, isi `FRONTEND_ORIGIN` dengan alamat frontend, lalu
deploy ulang. Melewatkan langkah ini membuat seluruh permintaan diblokir
browser dengan galat CORS; alamat yang ditolak tercatat di log Vercel.

### Yang perlu diingat

**Pembatas laju melemah di serverless.** Hitungannya disimpan di memori satu
proses, sedangkan tiap permintaan bisa dilayani proses yang berbeda. Sejak
pengajuan menuntut akun guru hal ini tidak kritis, tapi jangan diandalkan
sebagai satu-satunya pertahanan.

**Impor Excel membuat akun satu per satu.** `maxDuration` disetel 60 detik di
`backend/vercel.json` — cukup untuk puluhan baris. Bila suatu saat perlu
mengimpor ratusan sekaligus, bagi berkasnya menjadi beberapa unggahan.

**Supabase paket gratis dijeda setelah ~seminggu menganggur.** Hosting sebagus
apa pun tidak menolong bila database-nya tidur — nyalakan lagi lewat Supabase
Dashboard, dan sentuh aplikasinya sesekali agar tidak terjeda.

---

## Deploy ke Server Sekolah (alternatif, tanpa layanan luar)

Dipakai bila sekolah lebih memilih menjalankannya di komputer sendiri.

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
