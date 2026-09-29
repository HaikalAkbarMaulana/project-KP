import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, RefreshCw, ImageOff } from 'lucide-react';

import { unggahFotoAlat, BATAS_UKURAN_MB } from '../lib/penyimpanan';
import { PesanGalat } from './Keadaan';

/**
 * Pemilih dan pengunggah foto alat.
 *
 * Foto diunggah begitu dipilih, bukan saat formulir disimpan, supaya
 * petugas lab langsung melihat hasilnya dan tahu kalau ada yang salah.
 * Konsekuensinya: pemanggil bertanggung jawab membersihkan foto yang batal
 * dipakai — lihat penanganan di FormAlat.
 */
export default function UnggahFoto({ nilai, onChange, mati = false }) {
  const inputRef = useRef(null);
  const [mengunggah, setMengunggah] = useState(false);
  const [galat, setGalat] = useState('');
  const [gagalTampil, setGagalTampil] = useState(false);

  async function pilihBerkas(e) {
    const berkas = e.target.files?.[0];
    // Kosongkan input supaya memilih berkas yang sama dua kali tetap memicu
    // onChange — kalau tidak, percobaan ulang setelah gagal jadi tidak jalan.
    e.target.value = '';
    if (!berkas) return;

    setGalat('');
    setGagalTampil(false);
    setMengunggah(true);
    try {
      onChange(await unggahFotoAlat(berkas));
    } catch (err) {
      setGalat(err.message);
    } finally {
      setMengunggah(false);
    }
  }

  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-slate-600">Foto alat</span>

      <div className="flex items-start gap-4">
        <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          {mengunggah ? (
            <Loader2 size={22} className="animate-spin text-slate-400" />
          ) : nilai && !gagalTampil ? (
            <img
              src={nilai}
              alt="Pratinjau foto alat"
              className="h-full w-full object-cover"
              onError={() => setGagalTampil(true)}
            />
          ) : gagalTampil ? (
            <ImageOff size={22} className="text-rose-300" />
          ) : (
            <ImagePlus size={22} className="text-slate-300" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={mati || mengunggah}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {nilai ? <RefreshCw size={14} /> : <ImagePlus size={14} />}
              {mengunggah ? 'Mengunggah...' : nilai ? 'Ganti foto' : 'Pilih foto'}
            </button>

            {nilai && !mengunggah && (
              <button
                type="button"
                onClick={() => { setGagalTampil(false); onChange(null); }}
                disabled={mati}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
              >
                <Trash2 size={14} /> Hapus
              </button>
            )}
          </div>

          <p className="mt-2 text-xs text-slate-400">
            JPG, PNG, atau WEBP. Maksimal {BATAS_UKURAN_MB} MB. Opsional —
            alat tanpa foto tetap tampil dengan ikon bawaan.
          </p>

          {gagalTampil && (
            <p className="mt-1 text-xs text-rose-600">
              Foto tersimpan tapi tidak bisa ditampilkan. Coba unggah ulang.
            </p>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={pilihBerkas}
        className="hidden"
      />

      <div className="mt-2">
        <PesanGalat pesan={galat} />
      </div>
    </div>
  );
}
