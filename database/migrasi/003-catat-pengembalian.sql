-- ============================================================
--  Migrasi: fungsi catat_pengembalian
-- ============================================================
--
--  Jalankan HANYA bila panel admin menolak mencatat pengembalian dengan
--  pesan "Terjadi kesalahan pada server".
--
--  Latar belakangnya layak dicatat supaya tidak terulang. Fungsi ini
--  dipanggil backend lewat RPC sejak fitur pengembalian-dengan-rincian
--  dibuat, tetapi dulu dibuat langsung di database tanpa pernah ikut
--  ditulis ke schema.sql. Selama database aslinya masih dipakai, semuanya
--  berjalan normal dan tidak ada yang curiga.
--
--  Baru ketahuan saat database dipasang ulang dari nol di proyek Supabase
--  yang baru: seluruh tabel dan trigger terbentuk, tapi pencatatan
--  pengembalian gagal karena fungsi yang dipanggil tidak pernah ada.
--
--  Sekarang fungsinya sudah menjadi bagian dari schema.sql, jadi
--  pemasangan baru otomatis mendapatkannya. Berkas ini hanya untuk
--  database yang terlanjur dipasang sebelum perbaikan tersebut.
--
--  Aman dijalankan berulang.
-- ============================================================

create or replace function public.catat_pengembalian(
  p_id uuid,
  p_rusak integer,
  p_hilang integer,
  p_admin uuid,
  p_catatan text
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v public.peminjaman%rowtype;
  tgl_kembali date;
begin
  -- Dikunci agar dua petugas yang menekan tombol bersamaan tidak
  -- mengurangi stok dua kali untuk pengembalian yang sama.
  select * into v from public.peminjaman where id = p_id for update;

  if not found then
    raise exception 'TIDAK_DITEMUKAN';
  end if;
  if v.status <> 'dipinjam' then
    raise exception 'BUKAN_DIPINJAM';
  end if;
  if coalesce(p_rusak, 0) + coalesce(p_hilang, 0) > v.jumlah then
    raise exception 'RINCIAN_MELEBIHI';
  end if;

  -- Tanggal setempat (WIB), bukan UTC: antara 00:00-07:00 WIB, UTC masih
  -- menyebut tanggal kemarin.
  --
  -- greatest() menjaga constraint cek_tanggal_kembali_aktual. Alat yang
  -- diambil lebih awal dari jadwal lalu dikembalikan hari ini bisa punya
  -- tanggal_pinjam di masa depan; tanpa ini, pencatatannya ditolak.
  tgl_kembali := greatest((now() at time zone 'Asia/Jakarta')::date, v.tanggal_pinjam);

  -- URUTAN INI PENTING. Status diubah lebih dulu supaya trigger
  -- trg_sinkron_stok melepas jumlah_dipinjam. Kalau stok alat yang
  -- disesuaikan duluan, jumlah_baik bisa turun di bawah jumlah_dipinjam
  -- yang belum dilepas, dan constraint cek_dipinjam_wajar menolaknya --
  -- terjadi persis ketika seluruh unit dipinjam lalu dikembalikan rusak.
  update public.peminjaman
     set status                 = 'dikembalikan',
         tanggal_kembali_aktual = coalesce(tanggal_kembali_aktual, tgl_kembali),
         jumlah_kembali_rusak   = coalesce(p_rusak, 0),
         jumlah_hilang          = coalesce(p_hilang, 0),
         diproses_oleh          = coalesce(p_admin, diproses_oleh),
         catatan_admin          = coalesce(nullif(p_catatan, ''), catatan_admin)
   where id = p_id;

  -- Unit rusak pindah dari layak pakai ke rusak; unit hilang keluar dari
  -- inventaris sepenuhnya, jadi keduanya mengurangi jumlah_baik.
  update public.alat
     set jumlah_baik  = jumlah_baik - (coalesce(p_rusak, 0) + coalesce(p_hilang, 0)),
         jumlah_rusak = jumlah_rusak + coalesce(p_rusak, 0)
   where id = v.alat_id;
end;
$fn$;

revoke all on function public.catat_pengembalian(uuid, integer, integer, uuid, text)
  from public, anon, authenticated;

-- Setelah menjalankan ini, samakan hitungan stok untuk berjaga-jaga:
--   select public.hitung_ulang_stok();
