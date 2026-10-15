-- ============================================================
--  Migrasi v2 -> v3 : akun guru
-- ============================================================
--
--  Versi sebelumnya hanya mengenal satu jenis akun (admin/petugas lab);
--  guru mengajukan peminjaman lewat halaman publik tanpa akun. Mulai
--  versi ini guru punya akun sendiri supaya setiap peminjaman terikat
--  pada orang yang identitasnya sudah didaftarkan sekolah.
--
--  Guru masuk memakai NIP, bukan email. Supabase Auth mewajibkan email,
--  jadi backend menyusun email internal dari NIP (<nip>@guru.lokal).
--  Alamat itu tidak pernah ditampilkan dan tidak pernah dikirimi surat;
--  lupa sandi diselesaikan admin lewat panel, bukan lewat email.
--
--  Jalankan sekali di SQL Editor Supabase. Semua pernyataan di bawah
--  aman diulang (idempoten).
-- ============================================================

-- ------------------------------------------------------------
--  1. Kolom baru pada profil
-- ------------------------------------------------------------

-- Bawaannya 'admin' HANYA untuk mengisi baris yang sudah ada — semuanya
-- memang petugas lab. Setelah terisi, bawaannya diganti 'guru' di bawah
-- supaya kelalaian menyetel peran tidak pernah menghasilkan admin baru.
alter table public.profil add column if not exists peran text not null default 'admin';

-- NIP sekaligus nama pengguna bagi guru. Admin tetap masuk memakai email,
-- jadi kolom ini boleh kosong untuk mereka.
alter table public.profil add column if not exists nip text;
alter table public.profil add column if not exists mapel text;

-- Kata sandi awal guru adalah NIP-nya sendiri supaya gampang dibagikan.
-- NIP bukan rahasia — ia tercetak di dokumen kepegawaian dan ikut tampil
-- di daftar peminjaman — jadi akun wajib dipaksa berganti sandi saat
-- pertama kali masuk. Tanpa itu, siapa pun yang melihat layar petugas lab
-- bisa masuk sebagai guru mana pun, dan peminjaman atas nama seseorang
-- tidak lagi membuktikan apa-apa.
alter table public.profil add column if not exists harus_ganti_sandi boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cek_peran') then
    alter table public.profil add constraint cek_peran check (peran in ('admin', 'guru'));
  end if;

  -- Guru wajib punya NIP (itu nama penggunanya); admin tidak.
  if not exists (select 1 from pg_constraint where conname = 'cek_nip_guru') then
    alter table public.profil add constraint cek_nip_guru
      check (peran <> 'guru' or nip is not null);
  end if;
end $$;

-- Indeks parsial: NIP wajib unik bila diisi, tapi banyak admin boleh
-- sama-sama kosong (NULL tidak pernah bentrok di unique index biasa,
-- namun bentuk parsial ini membuat maksudnya tersurat).
create unique index if not exists idx_profil_nip on public.profil(nip) where nip is not null;

-- Baris lama sudah terisi 'admin' oleh bawaan di atas. Mulai sekarang
-- bawaannya yang paling tidak berbahaya.
alter table public.profil alter column peran set default 'guru';

-- ------------------------------------------------------------
--  2. Kaitan peminjaman -> akun guru
-- ------------------------------------------------------------
--
--  Sengaja boleh kosong dan memakai 'on delete set null', bukan cascade:
--
--    - kosong  : peminjaman yang dicatat petugas lab atas nama guru yang
--                tidak punya akun (guru honorer baru, atau guru yang
--                datang langsung ke lab) tetap bisa dicatat;
--    - set null: menghapus akun guru TIDAK ikut menghapus riwayat
--                peminjamannya. Identitasnya tetap terbaca dari kolom
--                nama_peminjam/nip_peminjam yang disalin saat pengajuan,
--                sehingga laporan dan hitungan stok tidak berubah.
--
--  Versi pertama aplikasi ini dulu memakai cascade dan itu sempat
--  menyeret riwayat peminjaman saat akun dihapus — lihat catatan di
--  migrasi 001.
alter table public.peminjaman
  add column if not exists guru_id uuid references public.profil(id) on delete set null;

create index if not exists idx_peminjaman_guru on public.peminjaman(guru_id)
  where guru_id is not null;

-- ------------------------------------------------------------
--  3. adalah_admin() harus memeriksa peran
-- ------------------------------------------------------------
--
--  PENTING. Sebelum migrasi ini fungsinya berbunyi "punya baris aktif di
--  profil". Begitu guru ikut punya baris di profil, bunyi itu membuat
--  setiap guru lolos sebagai admin — seluruh kebijakan tulis di tabel
--  alat, ruangan, kategori, dan profil bergantung padanya.
create or replace function public.adalah_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $fn$
  select exists (
    select 1 from public.profil p
     where p.id = auth.uid() and p.aktif and p.peran = 'admin'
  );
$fn$;

revoke all on function public.adalah_admin() from public, anon;
grant execute on function public.adalah_admin() to authenticated;

-- ------------------------------------------------------------
--  4. Kebijakan RLS untuk guru
-- ------------------------------------------------------------
--
--  Aplikasi mengakses database lewat service_role yang melewati RLS,
--  jadi kebijakan ini adalah lapis pertahanan kedua: ia yang menjaga
--  seandainya suatu saat frontend diizinkan menghubungi database
--  langsung memakai kunci anon.

-- Profil tidak perlu kebijakan baru: "profil_baca_admin" yang sudah ada
-- berbunyi (id = auth.uid() or adalah_admin()), jadi guru sudah otomatis
-- boleh membaca barisnya sendiri.

-- Guru boleh melihat riwayat peminjamannya sendiri, tidak milik orang
-- lain. Dua kebijakan select pada satu tabel bersifat ATAU, jadi
-- kebijakan admin yang sudah ada tetap berlaku berdampingan.
drop policy if exists "peminjaman_baca_sendiri" on public.peminjaman;
create policy "peminjaman_baca_sendiri" on public.peminjaman for select to authenticated
  using (guru_id = auth.uid());

-- ------------------------------------------------------------
--  Setelah menjalankan berkas ini
-- ------------------------------------------------------------
--
--  1. Pastikan akun lama tetap berperan admin:
--       select nama, email, peran from public.profil order by peran;
--
--  2. Daftarkan guru lewat panel admin (menu Akun -> Guru -> Impor Excel).
--     Jangan membuat akun guru langsung lewat SQL: kata sandi awal dan
--     penanda harus_ganti_sandi disetel oleh backend.
