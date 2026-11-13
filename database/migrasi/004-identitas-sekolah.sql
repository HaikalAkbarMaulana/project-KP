-- ============================================================
--  Migrasi: tabel identitas_sekolah (kop surat laporan)
-- ============================================================
--
--  Jalankan pada database yang sudah terlanjur dipasang sebelum tabel ini
--  ada. Pemasangan baru sudah mendapatkannya dari schema.sql.
--
--  Sebelumnya baris kop surat "PEMERINTAH KABUPATEN CILACAP" dan
--  "SMP NEGERI 3 KEDUNGREJA" tertulis langsung di dalam kode, sedangkan
--  alamatnya disimpan di localStorage peramban. Keduanya bermasalah:
--  yang pertama menuntut ubah kode lalu deploy ulang setiap ada perubahan,
--  yang kedua membuat tiap komputer harus mengetik ulang karena
--  localStorage tidak dibagi antarperangkat.
--
--  Identitas sekolah bukan milik satu orang melainkan milik sekolah,
--  jadi tempatnya memang di database.
--
--  Nilai bawaannya disalin dari kop surat resmi sekolah.
--
--  Aman dijalankan berulang.
-- ============================================================

-- Satu baris saja untuk seluruh sekolah. Dikunci lewat kolom "tunggal"
-- yang menjadi primary key dan hanya boleh bernilai true, sehingga tidak
-- mungkin ada dua baris identitas yang saling bertentangan.
create table if not exists public.identitas_sekolah (
  tunggal boolean primary key default true,
  pemerintah   text not null default 'PEMERINTAH KABUPATEN CILACAP',
  dinas        text not null default 'DINAS PENDIDIKAN DAN KEBUDAYAAN',
  nama_sekolah text not null default 'SMP NEGERI 3 KEDUNGREJA',
  alamat       text not null default 'Jalan Bendung Manganti, Bojongsari, Kedungreja, Cilacap 53263',
  telepon      text not null default 'Telepon 08112610181, 081391424525',
  laman        text not null default 'smpn3kedungreja.sch.id',
  posel        text not null default 'smpn3kedungreja@gmail.com',
  kota         text not null default 'Kedungreja',
  diperbarui_pada timestamptz not null default now(),
  constraint cek_satu_baris check (tunggal)
);

insert into public.identitas_sekolah (tunggal)
select true
 where not exists (select 1 from public.identitas_sekolah);

alter table public.identitas_sekolah enable row level security;

-- Kop surat bukan rahasia: halaman publik pun menampilkan nama sekolah.
-- Yang dibatasi hanya penyuntingannya.
drop policy if exists "identitas_baca_publik" on public.identitas_sekolah;
create policy "identitas_baca_publik" on public.identitas_sekolah for select using (true);

drop policy if exists "identitas_tulis_admin" on public.identitas_sekolah;
create policy "identitas_tulis_admin" on public.identitas_sekolah for all to authenticated
  using (public.adalah_admin()) with check (public.adalah_admin());
