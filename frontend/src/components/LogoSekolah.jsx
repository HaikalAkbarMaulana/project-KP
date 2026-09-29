/**
 * Lambang SMP Negeri 3 Kedungreja.
 *
 * Berkasnya ada di frontend/public/logo-sekolah.png sehingga dialamatkan
 * langsung dari akar situs, bukan lewat import — dengan begitu berkasnya
 * tidak ikut digabung ke dalam bundel JavaScript dan bisa disimpan browser
 * secara terpisah.
 *
 * Atribut width/height diisi angka aslinya agar browser menyediakan ruang
 * sebelum gambarnya selesai diunduh, sehingga tulisan di sebelahnya tidak
 * melompat saat halaman dimuat.
 */
export default function LogoSekolah({ ukuran = 40, kelas = '' }) {
  return (
    <img
      src="/logo-sekolah.png"
      alt="Lambang SMP Negeri 3 Kedungreja"
      width={ukuran}
      height={ukuran}
      className={`shrink-0 object-contain ${kelas}`}
    />
  );
}
