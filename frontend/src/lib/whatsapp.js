import { tanggalSingkat, sisaHari } from './format';

/**
 * Mengubah nomor HP Indonesia menjadi bentuk yang dikenali WhatsApp.
 *
 * WhatsApp menuntut kode negara tanpa tanda plus: 081234 harus menjadi
 * 6281234. Nomor yang sudah diawali 62 atau +62 dibiarkan, dan spasi serta
 * tanda hubung dibuang.
 */
export function nomorWhatsApp(noHp) {
  const angka = String(noHp || '').replace(/\D/g, '');
  if (!angka) return null;

  if (angka.startsWith('62')) return angka;
  if (angka.startsWith('0')) return `62${angka.slice(1)}`;
  if (angka.startsWith('8')) return `62${angka}`;
  return angka;
}

/**
 * Menyusun pesan yang sesuai dengan keadaan pengajuan.
 *
 * Isinya dibuat spesifik supaya petugas lab tidak perlu mengetik ulang —
 * tinggal tekan kirim. Guru pun langsung tahu alat mana yang dimaksud.
 */
export function pesanWhatsApp(item) {
  const sapaan = `Assalamualaikum, Bapak/Ibu ${item.nama_peminjam}.`;
  const alat = `${item.alat?.nama_alat} (${item.jumlah} unit)`;
  const kode = `Kode: ${item.kode_peminjaman}`;
  const penutup = 'Terima kasih.\n\nPetugas Lab SMP Negeri 3 Kedungreja';

  const telat = item.status === 'dipinjam' && sisaHari(item.tanggal_rencana_kembali) < 0;

  if (telat) {
    const lewat = Math.abs(sisaHari(item.tanggal_rencana_kembali));
    return [
      sapaan,
      `Kami ingatkan, peminjaman ${alat} sudah melewati batas pengembalian ` +
      `(${tanggalSingkat(item.tanggal_rencana_kembali)}), terlambat ${lewat} hari.`,
      'Mohon segera dikembalikan ke lab. ' + kode,
      penutup,
    ].join('\n\n');
  }

  const isi = {
    pending: `Pengajuan peminjaman ${alat} sudah kami terima dan sedang ditinjau. ${kode}`,
    disetujui:
      `Pengajuan peminjaman ${alat} sudah DISETUJUI. ` +
      `Silakan diambil di lab. ${kode}`,
    dipinjam:
      `Kami ingatkan, ${alat} yang Bapak/Ibu pinjam dijadwalkan kembali pada ` +
      `${tanggalSingkat(item.tanggal_rencana_kembali)}. ${kode}`,
    dikembalikan: `Pengembalian ${alat} sudah kami catat. ${kode}`,
    ditolak:
      `Mohon maaf, pengajuan peminjaman ${alat} belum dapat kami setujui.` +
      (item.catatan_admin ? `\nCatatan: ${item.catatan_admin}` : '') +
      `\n${kode}`,
    dibatalkan: `Pengajuan peminjaman ${alat} tercatat dibatalkan. ${kode}`,
  }[item.status] || `Mengenai peminjaman ${alat}. ${kode}`;

  return [sapaan, isi, penutup].join('\n\n');
}

/** Tautan yang membuka WhatsApp dengan pesan sudah terisi. */
export function tautanWhatsApp(item) {
  const nomor = nomorWhatsApp(item.no_hp);
  if (!nomor) return null;
  return `https://wa.me/${nomor}?text=${encodeURIComponent(pesanWhatsApp(item))}`;
}
