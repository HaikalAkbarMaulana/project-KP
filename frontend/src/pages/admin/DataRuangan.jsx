import DaftarReferensi from '../../components/DaftarReferensi';

export default function DataRuangan() {
  return (
    <DaftarReferensi
      judul="Ruangan"
      keterangan="Lokasi penyimpanan alat: lab, gudang, atau ruang kelas."
      endpoint="/ruangan"
      kolomNama="nama_ruangan"
      label="Ruangan"
      isian={[
        { kunci: 'nama_ruangan', label: 'Nama ruangan', wajib: true, maks: 100, contoh: 'Lab Komputer 2' },
        { kunci: 'penanggung_jawab', label: 'Penanggung jawab', maks: 120, contoh: 'Bu Rina, S.Pd.' },
        { kunci: 'keterangan', label: 'Keterangan', maks: 300, contoh: 'Lantai 2, sebelah perpustakaan' },
      ]}
    />
  );
}
