-- ============================================================
-- Migrasi 001 — dari skema v1 ke v2 ("login admin saja")
--
-- Jalankan HANYA bila database Anda sudah pernah dipakai dengan
-- schema.sql versi lama dan datanya ingin dipertahankan.
-- Database yang masih kosong cukup menjalankan schema.sql saja.
--
-- Yang dilakukan berkas ini:
--   1. Menyalin identitas guru dari tabel profil ke dalam baris
--      peminjaman, lalu melepas kaitannya (karena akun guru dihapus).
--   2. Menyalin nama pelaku ke dalam log aktivitas.
--   3. Menghapus seluruh akun non-admin.
--   4. Memecah stok alat menjadi jumlah_baik / jumlah_rusak /
--      jumlah_dipinjam, dengan jumlah_total & jumlah_tersedia
--      dihitung otomatis oleh PostgreSQL.
--
-- Urutannya penting: kaitan ke tabel profil dilepas LEBIH DULU,
-- baru akunnya dihapus. Kalau dibalik, penghapusan akun guru akan
-- ikut menyeret riwayat peminjamannya (guru_id memakai cascade).
--
-- SARAN: buat backup dulu (Supabase → Database → Backups). Langkah 3
-- tidak bisa dibatalkan. Berkas ini dirancang untuk dijalankan SEKALI.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 0. Lepas seluruh kebijakan RLS lama
--
-- PostgreSQL menolak penghapusan kolom yang masih dipakai kebijakan RLS.
-- Kebijakan v1 menyebut peminjaman.guru_id dan profil.peran — dua kolom
-- yang justru akan dibuang di bawah. Jadi kebijakannya dilepas dulu;
-- penggantinya dipasang kembali saat schema.sql dijalankan.
-- ------------------------------------------------------------
drop policy if exists "peminjaman_select_own_or_admin" on public.peminjaman;
drop policy if exists "peminjaman_insert_guru" on public.peminjaman;
drop policy if exists "peminjaman_update_admin_or_owner_cancel" on public.peminjaman;
drop policy if exists "profil_select_own_or_admin" on public.profil;
drop policy if exists "profil_update_own" on public.profil;
drop policy if exists "log_select_admin" on public.log_aktivitas;
drop policy if exists "log_insert_authenticated" on public.log_aktivitas;
drop policy if exists "alat_select_public" on public.alat;
drop policy if exists "alat_admin_write" on public.alat;
drop policy if exists "ruangan_select_public" on public.ruangan;
drop policy if exists "ruangan_admin_write" on public.ruangan;
drop policy if exists "kategori_select_public" on public.kategori;
drop policy if exists "kategori_admin_write" on public.kategori;

-- Buang trigger stok v1. Trigger ini menulis langsung ke jumlah_tersedia,
-- padahal di v2 kolom itu dihitung PostgreSQL dan tidak boleh ditulis.
-- Kalau dibiarkan, setiap persetujuan peminjaman akan gagal dengan
-- "column jumlah_tersedia can only be updated to DEFAULT".
drop trigger if exists trg_update_stok_alat on public.peminjaman;
drop function if exists public.fn_update_stok_alat();

-- ------------------------------------------------------------
-- 1. Peminjaman: identitas peminjam menjadi kolom teks
-- ------------------------------------------------------------
alter table public.peminjaman
  add column if not exists nama_peminjam text,
  add column if not exists nip_peminjam text,
  add column if not exists mapel text,
  add column if not exists no_hp text,
  add column if not exists diproses_oleh uuid;

-- Salin data guru selagi kaitannya masih ada
update public.peminjaman p
   set nama_peminjam = coalesce(p.nama_peminjam, g.nama, 'Tidak diketahui'),
       mapel         = coalesce(p.mapel, g.mapel),
       no_hp         = coalesce(p.no_hp, g.no_hp, '-')
  from public.profil g
 where g.id = p.guru_id;

update public.peminjaman
   set nama_peminjam = coalesce(nama_peminjam, 'Tidak diketahui'),
       no_hp         = coalesce(no_hp, '-');

update public.peminjaman
   set diproses_oleh = disetujui_oleh
 where diproses_oleh is null;

alter table public.peminjaman
  alter column nama_peminjam set not null,
  alter column no_hp set not null;

-- Lepas kaitan ke tabel profil SEBELUM akun dihapus
alter table public.peminjaman
  drop column if exists guru_id,
  drop column if exists disetujui_oleh;

alter table public.peminjaman
  add constraint peminjaman_diproses_oleh_fkey
  foreign key (diproses_oleh) references public.profil(id) on delete set null;

-- Status baru 'dibatalkan' dan pemeriksaan urutan tanggal
alter table public.peminjaman drop constraint if exists peminjaman_status_check;
alter table public.peminjaman add constraint peminjaman_status_check
  check (status in ('pending', 'disetujui', 'ditolak', 'dipinjam', 'dikembalikan', 'dibatalkan'));

alter table public.peminjaman drop constraint if exists cek_urutan_tanggal;
alter table public.peminjaman add constraint cek_urutan_tanggal
  check (tanggal_rencana_kembali >= tanggal_pinjam);

-- ------------------------------------------------------------
-- 2. Log aktivitas: simpan nama pelakunya sebagai teks
-- ------------------------------------------------------------
alter table public.log_aktivitas
  add column if not exists aktor_nama text;

update public.log_aktivitas l
   set aktor_nama = p.nama
  from public.profil p
 where p.id = l.aktor_id and l.aktor_nama is null;

-- Lepas kaitan ke akun yang akan dihapus, agar penghapusan tidak
-- tertahan foreign key. Namanya sudah tersalin di atas.
update public.log_aktivitas l
   set aktor_id = null
 where exists (
   select 1 from public.profil p
    where p.id = l.aktor_id and p.peran <> 'admin'
 );

alter table public.log_aktivitas drop constraint if exists log_aktivitas_aktor_id_fkey;
alter table public.log_aktivitas
  add constraint log_aktivitas_aktor_id_fkey
  foreign key (aktor_id) references public.profil(id) on delete set null;

-- ------------------------------------------------------------
-- 3. Profil: hanya menyisakan admin
-- ------------------------------------------------------------
alter table public.profil
  add column if not exists jabatan text,
  add column if not exists aktif boolean not null default true;

-- Hapus akun guru dari Supabase Auth. Baris profil-nya ikut terhapus
-- lewat "on delete cascade".
delete from auth.users u
 where exists (
   select 1 from public.profil p
    where p.id = u.id and p.peran <> 'admin'
 );

-- Sapu bersih baris profil non-admin yang tidak punya pasangan di
-- auth.users (misal data contoh yang dulu disisipkan manual) — tanpa
-- ini mereka akan tertinggal dan otomatis dianggap admin setelah
-- kolom peran dibuang.
delete from public.profil where peran <> 'admin';

alter table public.profil
  drop column if exists peran,
  drop column if exists mapel;

-- ------------------------------------------------------------
-- 4. Alat: stok baru dengan kolom terhitung
-- ------------------------------------------------------------
alter table public.alat
  add column if not exists jumlah_baik integer not null default 1,
  add column if not exists jumlah_rusak integer not null default 0,
  add column if not exists jumlah_dipinjam integer not null default 0,
  add column if not exists merk_tipe text,
  add column if not exists nomor_seri text,
  add column if not exists tahun_perolehan integer,
  add column if not exists sumber_dana text,
  add column if not exists harga_satuan numeric(14, 2),
  add column if not exists boleh_dipinjam boolean not null default true;

-- Terjemahkan kolom lama: seluruh unit dianggap layak pakai kecuali
-- alat yang ditandai rusak berat.
do $migrasi$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'alat' and column_name = 'kondisi'
  ) then
    update public.alat
       set jumlah_rusak = case when kondisi = 'rusak_berat' then jumlah_total else 0 end,
           jumlah_baik  = case when kondisi = 'rusak_berat' then 0 else jumlah_total end;
  end if;
end;
$migrasi$;

alter table public.alat
  drop column if exists kondisi,
  drop column if exists jumlah_total,
  drop column if exists jumlah_tersedia;

alter table public.alat
  add column jumlah_total integer generated always as (jumlah_baik + jumlah_rusak) stored,
  add column jumlah_tersedia integer generated always as (jumlah_baik - jumlah_dipinjam) stored;

alter table public.alat
  add constraint alat_jumlah_baik_check check (jumlah_baik >= 0),
  add constraint alat_jumlah_rusak_check check (jumlah_rusak >= 0),
  add constraint alat_jumlah_dipinjam_check check (jumlah_dipinjam >= 0),
  add constraint alat_tahun_perolehan_check
    check (tahun_perolehan is null or (tahun_perolehan between 1950 and 2100)),
  add constraint alat_sumber_dana_check
    check (sumber_dana is null or sumber_dana in ('BOS', 'APBD', 'APBN', 'Hibah', 'Komite', 'Lainnya')),
  add constraint alat_harga_satuan_check check (harga_satuan is null or harga_satuan >= 0);

-- ------------------------------------------------------------
-- 5. Batasan unik yang belum ada di skema lama
--
-- Dibungkus DO agar tidak gagal bila kebetulan sudah terpasang.
-- Kalau ada yang gagal karena datanya memang duplikat, rapikan dulu
-- baris kembarnya lalu jalankan blok ini lagi.
-- ------------------------------------------------------------
do $unik$
begin
  begin
    alter table public.ruangan add constraint ruangan_nama_ruangan_key unique (nama_ruangan);
  exception when duplicate_table or duplicate_object then null;
  end;

  begin
    alter table public.kategori add constraint kategori_nama_kategori_key unique (nama_kategori);
  exception when duplicate_table or duplicate_object then null;
  end;

  begin
    alter table public.profil add constraint profil_email_key unique (email);
  exception when duplicate_table or duplicate_object then null;
  end;
end;
$unik$;

commit;

-- ============================================================
-- LANGKAH LANJUTAN — jalankan berurutan setelah blok di atas sukses
-- ============================================================
--
-- 1) Jalankan ulang seluruh isi database/schema.sql.
--    Perintahnya memakai "create ... if not exists" dan
--    "create or replace", jadi aman diulang. Itu yang memasang
--    trigger stok, fungsi adalah_admin(), dan kebijakan RLS baru.
--
-- 2) Samakan hitungan stok dengan data peminjaman yang ada:
--
--      select public.hitung_ulang_stok();
--
-- 3) Pasang pengaman stok. Sengaja dipisah karena harus dijalankan
--    setelah stok dihitung ulang, agar tidak gagal karena data lama:
--
--      alter table public.alat add constraint cek_dipinjam_wajar
--        check (jumlah_dipinjam <= jumlah_baik);
--
-- 4) Pastikan tiap admin yang tersisa punya akun di Supabase Auth.
--    Periksa dengan:
--
--      select p.nama, p.email, (u.id is not null) as bisa_login
--        from public.profil p
--        left join auth.users u on u.id = p.id;
--
--    Bila kolom bisa_login bernilai false, akun itu tidak akan bisa
--    masuk. Hapus barisnya lalu buat ulang dengan:
--
--      cd backend && npm run buat-admin
-- ============================================================
