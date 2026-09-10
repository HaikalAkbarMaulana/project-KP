import DaftarReferensi from '../../components/DaftarReferensi';

export default function DataKategori() {
  return (
    <DaftarReferensi
      judul="Kategori Alat"
      keterangan="Pengelompokan alat agar katalog lebih mudah disaring."
      endpoint="/kategori"
      kolomNama="nama_kategori"
      label="Kategori"
      isian={[
        { kunci: 'nama_kategori', label: 'Nama kategori', wajib: true, maks: 100, contoh: 'Alat Peraga Biologi' },
      ]}
    />
  );
}
