/**
 * Pembacaan berkas Excel daftar guru.
 *
 * Dipisahkan dari komponen halaman supaya bisa diuji tanpa merender React,
 * dan supaya susunan kolom templat dan kolom yang dibaca saat impor tidak
 * mungkin berbeda — keduanya memakai KOLOM yang sama.
 */

/** Judul kolom templat, berurutan. */
export const KOLOM = ['Nama', 'NIP', 'Mapel', 'No HP'];

/** Baris contoh di templat, sekaligus memperagakan kolom yang boleh kosong. */
export const CONTOH = [
  ['Rina Kusumawati, S.Pd.', '198005202007012005', 'IPA', '081234567890'],
  ['Agus Setiawan, S.Kom.', '198711102011011003', 'TIK', '081298765432'],
  ['Siti Aminah, S.Pd.', '7045761662300023', '', ''],
];

/**
 * Penulisan judul kolom yang diterima.
 *
 * Sekolah sering sudah punya daftar guru sendiri dengan judul yang sedikit
 * berbeda, dan memaksa mereka mengetik ulang judulnya hanya akan membuat
 * impor gagal tanpa sebab yang jelas. Semua dicocokkan tanpa membedakan
 * huruf besar-kecil maupun spasi berlebih.
 */
const SINONIM = {
  nama: ['nama', 'nama lengkap', 'nama guru'],
  nip: ['nip', 'nuptk', 'nip / nuptk', 'nip/nuptk'],
  mapel: ['mapel', 'mata pelajaran', 'matapelajaran', 'bidang studi'],
  no_hp: ['no hp', 'no. hp', 'nohp', 'nomor hp', 'no_hp', 'hp', 'telepon', 'no telepon'],
};

function samakan(teks) {
  return String(teks).trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Mengambil satu kolom dari baris Excel, apa pun penulisan judulnya. */
export function ambilKolom(baris, bidang) {
  const diterima = SINONIM[bidang];
  for (const [judul, nilai] of Object.entries(baris)) {
    if (diterima.includes(samakan(judul))) {
      if (nilai !== undefined && nilai !== null && String(nilai).trim() !== '') return nilai;
    }
  }
  return '';
}

/**
 * Mengubah hasil mentah SheetJS menjadi baris siap kirim.
 *
 * Masalah terbesarnya ada pada NIP. Excel memperlakukan sel bernilai angka
 * sebagai bilangan, dan bilangan hanya teliti sampai 15 angka berarti —
 * sedangkan NIP punya 18. Begitu NIP mendarat di sel bertipe angka,
 * "198005202007012005" sudah berubah menjadi 198005202007012000 SEBELUM
 * aplikasi ini sempat membacanya. Kerusakannya terjadi di dalam Excel dan
 * tidak bisa dipulihkan dari sini.
 *
 * Karena itu baris semacam ini ditandai bermasalah, bukan ditebak. Akun
 * dengan NIP yang meleset satu digit akan terbuat tanpa ada yang sadar,
 * lalu gurunya tidak pernah bisa masuk dan tidak ada yang tahu sebabnya.
 */
export function bacaBarisGuru(mentah) {
  return mentah
    .map((r) => {
      const nipMentah = ambilKolom(r, 'nip');
      const hpMentah = ambilKolom(r, 'no_hp');

      return {
        nama: String(ambilKolom(r, 'nama') ?? '').trim(),
        nip: String(nipMentah ?? '').trim(),
        mapel: String(ambilKolom(r, 'mapel') ?? '').trim(),
        no_hp: rapikanNomorHp(hpMentah),
        // Penanda untuk layar, bukan untuk dikirim ke server.
        _nipRusak: typeof nipMentah === 'number',
      };
    })
    .filter((r) => r.nama || r.nip);
}

/** Pesan yang dipakai layar impor saat NIP terbaca sebagai angka. */
export const PESAN_NIP_RUSAK =
  'NIP terbaca sebagai angka sehingga digit terakhirnya sudah berubah di dalam Excel. ' +
  'Ubah format kolom NIP menjadi Teks, ketik ulang NIP-nya, lalu simpan dan unggah lagi.';

/**
 * Nomor HP yang terbaca sebagai angka kehilangan angka nol di depannya:
 * 081234567890 menjadi 81234567890.
 *
 * Tidak seperti NIP, ini bisa dipulihkan dengan aman karena nomor ponsel
 * Indonesia selalu diawali 08. Pemulihan hanya dilakukan bila polanya
 * memang cocok; selain itu nilainya dibiarkan apa adanya.
 */
function rapikanNomorHp(nilai) {
  if (nilai === undefined || nilai === null) return '';
  if (typeof nilai !== 'number') return String(nilai).trim();

  const digit = String(nilai);
  return /^8\d{8,11}$/.test(digit) ? `0${digit}` : digit;
}

/**
 * Menyusun templat Excel.
 *
 * Kolom NIP dan No HP dipaksa bertipe teks — itulah pertahanan utama
 * terhadap masalah di atas. Selama petugas mengisi di bawah baris contoh,
 * Excel mewarisi format selnya sehingga NIP tetap utuh.
 */
export function buatTemplat(XLSX) {
  const ws = XLSX.utils.aoa_to_sheet([KOLOM, ...CONTOH]);

  // Baris 2 ke bawah, kolom B (NIP) dan D (No HP).
  for (let baris = 2; baris <= CONTOH.length + 1; baris += 1) {
    for (const kolom of ['B', 'D']) {
      const sel = ws[`${kolom}${baris}`];
      if (sel) {
        sel.t = 's';
        sel.z = '@';
      }
    }
  }

  ws['!cols'] = [{ wch: 30 }, { wch: 22 }, { wch: 20 }, { wch: 16 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Daftar Guru');
  return wb;
}
