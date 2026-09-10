import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import { PesanGalat } from './Keadaan';

/**
 * Dialog konfirmasi untuk aksi yang tidak bisa dibatalkan.
 *
 * Menggantikan window.confirm() yang dipakai sebelumnya: dialog bawaan
 * browser tidak bisa menampilkan alasan penolakan dari server, sehingga
 * penghapusan yang gagal dulu berlalu tanpa pesan apa pun.
 */
export default function KonfirmasiHapus({ terbuka, judul, keterangan, labelTombol = 'Hapus', onTutup, onKonfirmasi }) {
  const [memproses, setMemproses] = useState(false);
  const [galat, setGalat] = useState('');

  async function jalankan() {
    setGalat('');
    setMemproses(true);
    try {
      await onKonfirmasi();
      onTutup();
    } catch (err) {
      setGalat(err.message);
    } finally {
      setMemproses(false);
    }
  }

  function tutup() {
    setGalat('');
    onTutup();
  }

  return (
    <Modal terbuka={terbuka} judul={judul} onTutup={tutup} lebar="max-w-md">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <AlertTriangle size={20} />
        </div>
        <p className="pt-2 text-sm text-slate-600">{keterangan}</p>
      </div>

      <div className="mt-4">
        <PesanGalat pesan={galat} />
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button" onClick={tutup} disabled={memproses}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          Batal
        </button>
        <button
          type="button" onClick={jalankan} disabled={memproses}
          className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
        >
          {memproses ? 'Memproses...' : labelTombol}
        </button>
      </div>
    </Modal>
  );
}
