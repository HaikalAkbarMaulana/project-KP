import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';

import { api } from '../lib/api';
import { useAmbilData } from '../hooks/useAmbilData';
import Modal from './Modal';
import KonfirmasiHapus from './KonfirmasiHapus';
import { Memuat, PesanGalat, Kosong } from './Keadaan';

/**
 * Daftar data master sederhana (ruangan & kategori).
 *
 * Keduanya dipakai bersama karena alur kerjanya identik — hanya kolom
 * isiannya yang berbeda — sama seperti CRUD-nya di backend yang juga
 * dibangun dari satu pabrik route.
 */
export default function DaftarReferensi({ judul, keterangan, endpoint, kolomNama, label, isian }) {
  const { data, memuat, galat, muatUlang } = useAmbilData(endpoint);
  const daftar = data?.data ?? [];

  const [formTerbuka, setFormTerbuka] = useState(false);
  const [sedangEdit, setSedangEdit] = useState(null);
  const [akanDihapus, setAkanDihapus] = useState(null);
  const [paksaHapus, setPaksaHapus] = useState(false);

  function bukaForm(baris) {
    setSedangEdit(baris);
    setFormTerbuka(true);
  }

  function siapkanHapus(baris) {
    setPaksaHapus(false);
    setAkanDihapus(baris);
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-900">{judul}</h1>
          <p className="text-sm text-slate-500">{keterangan}</p>
        </div>
        <button
          type="button"
          onClick={() => bukaForm(null)}
          className="flex items-center gap-2 self-start rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
        >
          <Plus size={18} /> Tambah
        </button>
      </div>

      <PesanGalat pesan={galat} onCobaLagi={muatUlang} />

      {galat ? null : memuat ? (
        <Memuat />
      ) : daftar.length === 0 ? (
        <Kosong judul={`Belum ada ${label.toLowerCase()}`} keterangan="Tambahkan lewat tombol di atas." />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {daftar.map((baris) => (
            <li key={baris.id} className="flex items-center justify-between gap-4 px-5 py-3">
              <div className="min-w-0">
                <p className="font-medium text-ink-900">{baris[kolomNama]}</p>
                <p className="truncate text-sm text-slate-500">
                  {isian
                    .filter((i) => i.kunci !== kolomNama && baris[i.kunci])
                    .map((i) => baris[i.kunci])
                    .join(' · ')}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button" onClick={() => bukaForm(baris)} title="Edit"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-brand-700"
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button" onClick={() => siapkanHapus(baris)} title="Hapus"
                  className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <FormReferensi
        terbuka={formTerbuka}
        baris={sedangEdit}
        label={label}
        endpoint={endpoint}
        isian={isian}
        onTutup={() => setFormTerbuka(false)}
        onSimpan={() => { setFormTerbuka(false); muatUlang(); }}
      />

      <KonfirmasiHapus
        terbuka={!!akanDihapus}
        judul={`Hapus ${label.toLowerCase()}`}
        keterangan={
          akanDihapus
            ? `"${akanDihapus[kolomNama]}" akan dihapus. Tindakan ini tidak bisa dibatalkan.`
            : ''
        }
        labelTombol={paksaHapus ? 'Ya, hapus juga keterkaitannya' : 'Hapus'}
        onTutup={() => setAkanDihapus(null)}
        onKonfirmasi={async () => {
          try {
            await api.delete(`${endpoint}/${akanDihapus.id}${paksaHapus ? '?paksa=1' : ''}`);
            muatUlang();
          } catch (err) {
            // Penolakan pertama karena masih dipakai alat: tawarkan
            // penghapusan paksa lewat klik kedua, jangan diam-diam dipaksa.
            if (err.status === 409 && !paksaHapus) setPaksaHapus(true);
            throw err;
          }
        }}
      />
    </div>
  );
}

function FormReferensi({ terbuka, baris, label, endpoint, isian, onTutup, onSimpan }) {
  const kosong = Object.fromEntries(isian.map((i) => [i.kunci, '']));
  const [form, setForm] = useState(kosong);
  const [galat, setGalat] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);
  const [idTerakhir, setIdTerakhir] = useState(null);

  const penanda = terbuka ? (baris?.id ?? 'baru') : null;
  if (penanda !== idTerakhir) {
    setIdTerakhir(penanda);
    setGalat('');
    setForm(
      baris
        ? Object.fromEntries(isian.map((i) => [i.kunci, baris[i.kunci] ?? '']))
        : kosong
    );
  }

  async function simpan(e) {
    e.preventDefault();
    setGalat('');
    setMenyimpan(true);
    try {
      if (baris) await api.put(`${endpoint}/${baris.id}`, form);
      else await api.post(endpoint, form);
      onSimpan();
    } catch (err) {
      setGalat(err.message);
    } finally {
      setMenyimpan(false);
    }
  }

  return (
    <Modal
      terbuka={terbuka}
      judul={baris ? `Edit ${label.toLowerCase()}` : `Tambah ${label.toLowerCase()}`}
      onTutup={onTutup}
      lebar="max-w-md"
    >
      <form onSubmit={simpan} className="space-y-4">
        <PesanGalat pesan={galat} />

        {isian.map((i) => (
          <label key={i.kunci} className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              {i.label} {i.wajib && <span className="text-rose-500">*</span>}
            </span>
            <input
              required={i.wajib}
              maxLength={i.maks || 100}
              value={form[i.kunci]}
              onChange={(e) => setForm((f) => ({ ...f, [i.kunci]: e.target.value }))}
              placeholder={i.contoh}
              className="input"
            />
          </label>
        ))}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button" onClick={onTutup}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Batal
          </button>
          <button
            type="submit" disabled={menyimpan}
            className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {menyimpan ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
