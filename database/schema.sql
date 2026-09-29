-- ============================================================
-- Skema Database: Sistem Inventaris & Peminjaman Alat Lab
-- SMPN 3 Kedungreja
-- Database: Supabase (PostgreSQL)
--
-- Versi 2 — login HANYA untuk admin/petugas lab.
-- Guru mengajukan peminjaman lewat form publik tanpa akun.
--
-- Jalankan seluruh isi berkas ini di Supabase SQL Editor.
-- Untuk instalasi yang sudah berisi data, jalankan
-- database/migrasi/001-admin-saja.sql terlebih dahulu.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. PROFIL — akun pengelola (admin/petugas lab) SAJA.
--    Tidak ada akun guru/siswa. Satu baris di sini = satu orang
--    yang boleh masuk ke panel admin.
-- ------------------------------------------------------------
create table if not exists public.profil (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text not null,
  email text not null unique,
  no_hp text,
  jabatan text,                              -- contoh: 'Kepala Lab IPA', 'Petugas Lab Komputer'
  aktif boolean not null default true,       -- nonaktifkan tanpa menghapus riwayat
  dibuat_pada timestamptz not null default now()
);

comment on table public.profil is
  'Akun admin/petugas lab. Hanya pemilik baris di tabel ini yang boleh masuk ke panel admin.';
comment on column public.profil.aktif is
  'Set false untuk mencabut akses tanpa menghapus jejak aktivitasnya.';

-- ------------------------------------------------------------
-- 2. RUANGAN — lokasi penyimpanan alat
-- ------------------------------------------------------------
create table if not exists public.ruangan (
  id uuid primary key default gen_random_uuid(),
  nama_ruangan text not null unique,
  keterangan text,
  penanggung_jawab text,
  dibuat_pada timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. KATEGORI ALAT
-- ------------------------------------------------------------
create table if not exists public.kategori (
  id uuid primary key default gen_random_uuid(),
  nama_kategori text not null unique,
  dibuat_pada timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4. ALAT — inventaris lab
--
-- Pembagian jumlah dibuat eksplisit dan sebagian DIHITUNG OTOMATIS
-- oleh PostgreSQL supaya stok tidak pernah melenceng:
--
--   jumlah_baik      : unit layak pakai       (diisi admin)
--   jumlah_rusak     : unit tidak layak pakai (diisi admin)
--   jumlah_dipinjam  : unit sedang keluar     (dijaga trigger, jangan diisi manual)
--   jumlah_total     = jumlah_baik + jumlah_rusak     (dihitung otomatis)
--   jumlah_tersedia  = jumlah_baik - jumlah_dipinjam  (dihitung otomatis)
-- ------------------------------------------------------------
create table if not exists public.alat (
  id uuid primary key default gen_random_uuid(),
  kode_alat text unique not null,
  nama_alat text not null,
  kategori_id uuid references public.kategori(id) on delete set null,
  ruangan_id uuid references public.ruangan(id) on delete set null,

  jumlah_baik integer not null default 1 check (jumlah_baik >= 0),
  jumlah_rusak integer not null default 0 check (jumlah_rusak >= 0),
  jumlah_dipinjam integer not null default 0 check (jumlah_dipinjam >= 0),
  jumlah_total integer generated always as (jumlah_baik + jumlah_rusak) stored,
  jumlah_tersedia integer generated always as (jumlah_baik - jumlah_dipinjam) stored,

  -- Kolom administrasi inventaris sekolah (Buku Inventaris Barang)
  merk_tipe text,
  nomor_seri text,
  tahun_perolehan integer check (tahun_perolehan is null or (tahun_perolehan between 1950 and 2100)),
  sumber_dana text check (sumber_dana is null or sumber_dana in ('BOS', 'APBD', 'APBN', 'Hibah', 'Komite', 'Lainnya')),
  harga_satuan numeric(14, 2) check (harga_satuan is null or harga_satuan >= 0),

  boleh_dipinjam boolean not null default true,   -- alat tertentu (mis. bahan kimia) tidak dipinjamkan
  foto_url text,
  deskripsi text,
  dibuat_pada timestamptz not null default now(),
  diperbarui_pada timestamptz not null default now(),

  -- Pengaman utama: unit yang sedang dipinjam tidak boleh melebihi unit layak
  -- pakai. Ini yang mencegah persetujuan berlebih membuat stok jadi minus.
  constraint cek_dipinjam_wajar check (jumlah_dipinjam <= jumlah_baik)
);

create index if not exists idx_alat_kategori on public.alat(kategori_id);
create index if not exists idx_alat_ruangan on public.alat(ruangan_id);
create index if not exists idx_alat_nama on public.alat(lower(nama_alat));

comment on column public.alat.jumlah_dipinjam is
  'Dijaga otomatis oleh trigger trg_sinkron_stok. Jangan diubah manual.';

-- ------------------------------------------------------------
-- 5. PEMINJAMAN — diajukan guru lewat form publik (tanpa akun).
--    Identitas peminjam disimpan sebagai teks, bukan relasi ke user.
-- ------------------------------------------------------------
create table if not exists public.peminjaman (
  id uuid primary key default gen_random_uuid(),
  kode_peminjaman text unique not null,      -- sekaligus kode untuk melacak status

  nama_peminjam text not null,
  nip_peminjam text,
  mapel text,
  no_hp text not null,

  alat_id uuid not null references public.alat(id) on delete restrict,
  jumlah integer not null check (jumlah > 0),
  keperluan text not null,
  tanggal_pinjam date not null,
  tanggal_rencana_kembali date not null,
  tanggal_kembali_aktual date,

  status text not null default 'pending'
    check (status in ('pending', 'disetujui', 'ditolak', 'dipinjam', 'dikembalikan', 'dibatalkan')),
  catatan_admin text,
  diproses_oleh uuid references public.profil(id) on delete set null,

  dibuat_pada timestamptz not null default now(),
  diperbarui_pada timestamptz not null default now(),

  constraint cek_urutan_tanggal check (tanggal_rencana_kembali >= tanggal_pinjam),
  constraint cek_tanggal_kembali_aktual check (
    tanggal_kembali_aktual is null or tanggal_kembali_aktual >= tanggal_pinjam
  )
);

create index if not exists idx_peminjaman_alat on public.peminjaman(alat_id);
create index if not exists idx_peminjaman_status on public.peminjaman(status);
create index if not exists idx_peminjaman_dibuat on public.peminjaman(dibuat_pada desc);
create index if not exists idx_peminjaman_nama on public.peminjaman(lower(nama_peminjam));

-- ------------------------------------------------------------
-- 6. LOG AKTIVITAS
-- ------------------------------------------------------------
create table if not exists public.log_aktivitas (
  id uuid primary key default gen_random_uuid(),
  aktor_id uuid references public.profil(id) on delete set null,
  aktor_nama text,                 -- disalin agar riwayat tetap terbaca bila akun dihapus
  aksi text not null,
  keterangan text,
  dibuat_pada timestamptz not null default now()
);

create index if not exists idx_log_dibuat on public.log_aktivitas(dibuat_pada desc);

-- ============================================================
-- TRIGGER
-- ============================================================

-- Semua fungsi di bawah memakai "set search_path = public" agar nama tabel
-- di dalamnya selalu merujuk skema yang benar, tidak bisa dibelokkan lewat
-- search_path pemanggilnya.

-- Menjaga kolom diperbarui_pada
create or replace function public.fn_sentuh_diperbarui()
returns trigger language plpgsql
set search_path = public
as $fn$
begin
  new.diperbarui_pada = now();
  return new;
end;
$fn$;

drop trigger if exists trg_sentuh_alat on public.alat;
create trigger trg_sentuh_alat
  before update on public.alat
  for each row execute function public.fn_sentuh_diperbarui();

drop trigger if exists trg_sentuh_peminjaman on public.peminjaman;
create trigger trg_sentuh_peminjaman
  before update on public.peminjaman
  for each row execute function public.fn_sentuh_diperbarui();

-- ------------------------------------------------------------
-- Sinkronisasi jumlah_dipinjam pada tabel alat.
--
-- Aturannya satu kalimat: status 'disetujui' dan 'dipinjam' berarti unitnya
-- sedang ditahan; status lain berarti tidak. Trigger ini membandingkan
-- kondisi SEBELUM dan SESUDAH, jadi semua perpindahan status (termasuk
-- pembatalan setelah disetujui, atau perubahan jumlah/alat di tengah jalan)
-- tertangani tanpa kasus khusus.
-- ------------------------------------------------------------
create or replace function public.fn_sinkron_stok()
returns trigger language plpgsql
security definer
set search_path = public
as $fn$
declare
  ditahan_sebelum boolean := false;
  ditahan_sesudah boolean := false;
begin
  if (tg_op <> 'INSERT') then
    ditahan_sebelum := old.status in ('disetujui', 'dipinjam');
  end if;
  if (tg_op <> 'DELETE') then
    ditahan_sesudah := new.status in ('disetujui', 'dipinjam');
  end if;

  -- Keluar lebih awal bila perubahannya tidak menyangkut stok sama sekali.
  --
  -- Tanpa ini, mengubah kolom apa pun pada baris peminjaman tetap menulis
  -- ke tabel alat walau hasilnya nol. Itu pernah membuat penghapusan akun
  -- admin gagal: penghapusan mengosongkan kolom diproses_oleh, trigger ini
  -- ikut terbangun, lalu menyentuh tabel alat — padahal layanan Auth
  -- Supabase tidak punya izin ke sana. Fungsi ini juga SECURITY DEFINER
  -- agar tetap berjalan apa pun peran yang memicunya.
  if (tg_op = 'UPDATE'
      and ditahan_sebelum = ditahan_sesudah
      and new.jumlah = old.jumlah
      and new.alat_id = old.alat_id) then
    return new;
  end if;

  -- Lepaskan tahanan lama
  if ditahan_sebelum then
    update public.alat
       set jumlah_dipinjam = jumlah_dipinjam - old.jumlah
     where id = old.alat_id;
  end if;

  -- Tahan sesuai kondisi baru
  if ditahan_sesudah then
    update public.alat
       set jumlah_dipinjam = jumlah_dipinjam + new.jumlah
     where id = new.alat_id;
  end if;

  if (tg_op = 'DELETE') then
    return old;
  end if;
  return new;
end;
$fn$;

-- Trigger stok versi lama harus dibuang lebih dulu. Isinya menulis langsung
-- ke jumlah_tersedia, yang di skema ini dihitung PostgreSQL dan tidak bisa
-- ditulis siapa pun — dibiarkan hidup berdampingan, tiap persetujuan
-- peminjaman akan gagal.
drop trigger if exists trg_update_stok_alat on public.peminjaman;
drop function if exists public.fn_update_stok_alat();

drop trigger if exists trg_sinkron_stok on public.peminjaman;
create trigger trg_sinkron_stok
  after insert or update or delete on public.peminjaman
  for each row execute function public.fn_sinkron_stok();

-- ------------------------------------------------------------
-- Hitung ulang jumlah_dipinjam dari nol.
-- Jalankan lewat SQL Editor bila stok pernah diutak-atik manual:
--   select public.hitung_ulang_stok();
-- ------------------------------------------------------------
create or replace function public.hitung_ulang_stok()
returns void language sql
set search_path = public
as $fn$
  update public.alat a
     set jumlah_dipinjam = coalesce((
       select sum(p.jumlah)
         from public.peminjaman p
        where p.alat_id = a.id
          and p.status in ('disetujui', 'dipinjam')
     ), 0);
$fn$;

-- ============================================================
-- ROW LEVEL SECURITY
--
-- Backend memakai service_role key sehingga melewati RLS; kebijakan di
-- bawah ini yang melindungi bila ada yang memakai anon key langsung dari
-- browser (anon key selalu terlihat di kode frontend).
-- ============================================================

-- Pengecekan admin dibungkus SECURITY DEFINER. Tanpa ini, kebijakan pada
-- tabel profil yang menyeleksi tabel profil sendiri akan gagal dengan
-- "infinite recursion detected in policy for relation profil".
create or replace function public.adalah_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $fn$
  select exists (
    select 1 from public.profil p
     where p.id = auth.uid() and p.aktif
  );
$fn$;

-- Hanya pengguna yang sudah masuk yang perlu memanggil fungsi ini. Peran
-- anon sengaja tidak diberi izin: kebijakan tulis di bawah dibatasi ke
-- peran authenticated, jadi anon tidak pernah ikut mengevaluasinya.
--
-- Database linter Supabase akan tetap menandai fungsi ini sebagai
-- "SECURITY DEFINER dapat dijalankan pengguna yang masuk". Itu memang
-- disengaja dan tidak bisa dihindari: kebijakan RLS dievaluasi sebagai
-- peran pemanggil, jadi authenticated wajib punya izin menjalankannya.
-- Aman, karena fungsi ini hanya menjawab tentang pemanggilnya sendiri
-- (lewat auth.uid()) dan tidak membocorkan apa pun tentang orang lain.
revoke all on function public.adalah_admin() from public, anon;
grant execute on function public.adalah_admin() to authenticated;

alter table public.profil enable row level security;
alter table public.ruangan enable row level security;
alter table public.kategori enable row level security;
alter table public.alat enable row level security;
alter table public.peminjaman enable row level security;
alter table public.log_aktivitas enable row level security;

drop policy if exists "alat_select_public" on public.alat;
drop policy if exists "alat_admin_write" on public.alat;
drop policy if exists "ruangan_select_public" on public.ruangan;
drop policy if exists "ruangan_admin_write" on public.ruangan;
drop policy if exists "kategori_select_public" on public.kategori;
drop policy if exists "kategori_admin_write" on public.kategori;
drop policy if exists "profil_select_own_or_admin" on public.profil;
drop policy if exists "profil_update_own" on public.profil;
drop policy if exists "peminjaman_select_own_or_admin" on public.peminjaman;
drop policy if exists "peminjaman_insert_guru" on public.peminjaman;
drop policy if exists "peminjaman_update_admin_or_owner_cancel" on public.peminjaman;
drop policy if exists "log_select_admin" on public.log_aktivitas;
drop policy if exists "log_insert_authenticated" on public.log_aktivitas;

drop policy if exists "alat_baca_publik" on public.alat;
drop policy if exists "alat_tulis_admin" on public.alat;
drop policy if exists "ruangan_baca_publik" on public.ruangan;
drop policy if exists "ruangan_tulis_admin" on public.ruangan;
drop policy if exists "kategori_baca_publik" on public.kategori;
drop policy if exists "kategori_tulis_admin" on public.kategori;
drop policy if exists "profil_baca_admin" on public.profil;
drop policy if exists "peminjaman_baca_admin" on public.peminjaman;
drop policy if exists "log_baca_admin" on public.log_aktivitas;

-- Katalog inventaris boleh dibaca siapa saja, ditulis hanya admin.
--
-- Kebijakan tulis dibatasi "to authenticated" bukan sekadar demi kerapian:
-- tanpa itu, permintaan anon ikut mengevaluasi adalah_admin() sehingga
-- peran anon terpaksa diberi izin menjalankannya.
create policy "alat_baca_publik" on public.alat for select using (true);
create policy "alat_tulis_admin" on public.alat for all to authenticated
  using (public.adalah_admin()) with check (public.adalah_admin());

create policy "ruangan_baca_publik" on public.ruangan for select using (true);
create policy "ruangan_tulis_admin" on public.ruangan for all to authenticated
  using (public.adalah_admin()) with check (public.adalah_admin());

create policy "kategori_baca_publik" on public.kategori for select using (true);
create policy "kategori_tulis_admin" on public.kategori for all to authenticated
  using (public.adalah_admin()) with check (public.adalah_admin());

-- Profil: admin boleh membaca daftar admin; perubahan hanya lewat backend.
create policy "profil_baca_admin" on public.profil for select to authenticated
  using (id = auth.uid() or public.adalah_admin());

-- Peminjaman & log: hanya bisa dibaca admin, dan tidak ada kebijakan tulis
-- sama sekali — semua penulisan harus lewat backend yang sudah memvalidasi.
-- Data peminjaman memuat nama dan nomor HP guru, jadi jangan dibuka publik.
create policy "peminjaman_baca_admin" on public.peminjaman for select to authenticated
  using (public.adalah_admin());
create policy "log_baca_admin" on public.log_aktivitas for select to authenticated
  using (public.adalah_admin());

-- ============================================================
-- PENYIMPANAN FOTO ALAT (Supabase Storage)
--
-- Batas ukuran dan jenis berkas sengaja dipasang di tingkat bucket agar
-- dipaksakan Supabase sendiri. Pemeriksaan di browser tetap ada, tapi itu
-- hanya demi pesan yang ramah — bukan pengaman.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'foto-alat',
  'foto-alat',
  true,
  2097152,  -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "foto_alat_baca_publik" on storage.objects;
drop policy if exists "foto_alat_unggah_admin" on storage.objects;
drop policy if exists "foto_alat_ubah_admin" on storage.objects;
drop policy if exists "foto_alat_hapus_admin" on storage.objects;

-- Foto tampil di katalog publik, jadi boleh dibaca siapa saja.
create policy "foto_alat_baca_publik" on storage.objects for select
  using (bucket_id = 'foto-alat');

-- Hanya admin aktif yang boleh mengunggah, mengganti, dan menghapus.
create policy "foto_alat_unggah_admin" on storage.objects for insert to authenticated
  with check (bucket_id = 'foto-alat' and public.adalah_admin());

create policy "foto_alat_ubah_admin" on storage.objects for update to authenticated
  using (bucket_id = 'foto-alat' and public.adalah_admin())
  with check (bucket_id = 'foto-alat' and public.adalah_admin());

create policy "foto_alat_hapus_admin" on storage.objects for delete to authenticated
  using (bucket_id = 'foto-alat' and public.adalah_admin());

-- ============================================================
-- DATA AWAL
--
-- Memakai "where not exists", bukan "on conflict". Berkas ini juga
-- dijalankan ulang di atas database hasil migrasi, dan di sana tabel
-- ruangan/kategori mungkin belum punya batasan unik yang dibutuhkan
-- "on conflict" — perintahnya akan gagal, bukan sekadar dilewati.
-- ============================================================
insert into public.ruangan (nama_ruangan, keterangan)
select v.nama, v.ket
  from (values
    ('Lab Komputer', 'Ruang laboratorium komputer'),
    ('Lab IPA', 'Ruang laboratorium IPA'),
    ('Gudang Inventaris', 'Penyimpanan alat cadangan')
  ) as v(nama, ket)
 where not exists (select 1 from public.ruangan r where r.nama_ruangan = v.nama);

insert into public.kategori (nama_kategori)
select v.nama
  from (values
    ('Perangkat Komputer'),
    ('Jaringan & Multimedia'),
    ('Alat Peraga IPA'),
    ('Alat Ukur'),
    ('Alat Gelas & Bahan'),
    ('Mebelair Lab')
  ) as v(nama)
 where not exists (select 1 from public.kategori k where k.nama_kategori = v.nama);
