import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Download, Upload } from 'lucide-react';

import { api, keQuery } from '../../lib/api';
import { useAmbilData } from '../../hooks/useAmbilData';
import { useTundaNilai } from '../../hooks/useTundaNilai';
import { angka, rupiah, SUMBER_DANA } from '../../lib/format';
import { hapusFotoAlat } from '../../lib/penyimpanan';
import {
  KOLOM as KOLOM_ALAT, KOLOM_WAJIB, bacaBarisAlat, buatTemplat as buatTemplatAlat,
} from '../../lib/excelAlat';
import Modal from '../../components/Modal';
import DialogImporExcel from '../../components/DialogImporExcel';
import KonfirmasiHapus from '../../components/KonfirmasiHapus';
import UnggahFoto from '../../components/UnggahFoto';
import { Memuat, PesanGalat, Kosong } from '../../components/Keadaan';

const PER_HALAMAN = 25;

const FORM_KOSONG = {
  kode_alat: '', nama_alat: '', kategori_id: '', ruangan_id: '',
  jumlah_baik: 1, jumlah_rusak: 0,
  merk_tipe: '', nomor_seri: '', tahun_perolehan: '', sumber_dana: '', harga_satuan: '',
  boleh_dipinjam: true, deskripsi: '',
};

export default function DataAlat() {
  const [pencarian, setPencarian] = useState('');
  const [kategoriDipilih, setKategoriDipilih] = useState('');
  const [ruanganDipilih, setRuanganDipilih] = useState('');
  const [halaman, setHalaman] = useState(1);

  const [formTerbuka, setFormTerbuka] = useState(false);
  const [sedangEdit, setSedangEdit] = useState(null);
  const [akanDihapus, setAkanDihapus] = useState(null);
  const [pesanUnduh, setPesanUnduh] = useState('');
  const [imporTerbuka, setImporTerbuka] = useState(false);

  const kataKunci = useTundaNilai(pencarian);

  const kategori = useAmbilData('/kategori');
  const ruangan = useAmbilData('/ruangan');

  const pathAlat = useMemo(
    () => `/alat${keQuery({
      q: kataKunci,
      kategori_id: kategoriDipilih,
      ruangan_id: ruanganDipilih,
      halaman,
      per_halaman: PER_HALAMAN,
    })}`,
    [kataKunci, kategoriDipilih, ruanganDipilih, halaman]
  );

  const { data, memuat, galat, muatUlang } = useAmbilData(pathAlat);
  const daftarAlat = data?.data ?? [];
  const total = data?.halaman?.total ?? 0;
  const totalHalaman = Math.max(Math.ceil(total / PER_HALAMAN), 1);

  async function unduhLaporan() {
    setPesanUnduh('');
    try {
      await api.unduh(
        `/laporan/inventaris.csv${keQuery({ kategori_id: kategoriDipilih, ruangan_id: ruanganDipilih })}`,
        'inventaris-lab.csv'
      );
    } catch (err) {
      setPesanUnduh(err.message);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-900">Data Inventaris</h1>
          <p className="text-sm text-slate-500">
            {angka(total)} jenis alat tercatat di lab komputer & IPA.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button" onClick={unduhLaporan}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download size={16} /> Unduh CSV
          </button>
          <button
            type="button" onClick={() => setImporTerbuka(true)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-brand-200 hover:text-brand-700"
          >
            <Upload size={16} /> Impor Excel
          </button>
          <button
            type="button"
            onClick={() => { setSedangEdit(null); setFormTerbuka(true); }}
            className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
          >
            <Plus size={18} /> Tambah Alat
          </button>
        </div>
      </div>

      <PesanGalat pesan={pesanUnduh} />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={pencarian}
            onChange={(e) => { setPencarian(e.target.value); setHalaman(1); }}
            placeholder="Cari nama, kode, atau merk..."
            aria-label="Cari alat"
            className="input pl-9"
          />
        </div>
        <select
          value={kategoriDipilih}
          onChange={(e) => { setKategoriDipilih(e.target.value); setHalaman(1); }}
          aria-label="Saring kategori" className="input"
        >
          <option value="">Semua kategori</option>
          {(kategori.data?.data ?? []).map((k) => (
            <option key={k.id} value={k.id}>{k.nama_kategori}</option>
          ))}
        </select>
        <select
          value={ruanganDipilih}
          onChange={(e) => { setRuanganDipilih(e.target.value); setHalaman(1); }}
          aria-label="Saring ruangan" className="input"
        >
          <option value="">Semua ruangan</option>
          {(ruangan.data?.data ?? []).map((r) => (
            <option key={r.id} value={r.id}>{r.nama_ruangan}</option>
          ))}
        </select>
      </div>

      <PesanGalat pesan={galat} onCobaLagi={muatUlang} />

      {galat ? null : memuat ? (
        <Memuat />
      ) : daftarAlat.length === 0 ? (
        <Kosong
          judul="Belum ada alat yang cocok"
          keterangan="Tambahkan alat baru atau ubah penyaring pencarian."
        />
      ) : (
        <>
          <TabelAlat
            daftar={daftarAlat}
            onEdit={(alat) => { setSedangEdit(alat); setFormTerbuka(true); }}
            onHapus={setAkanDihapus}
          />

          {totalHalaman > 1 && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-500">Halaman {halaman} dari {totalHalaman}</p>
              <div className="flex gap-2">
                <button
                  type="button" onClick={() => setHalaman((h) => h - 1)} disabled={halaman <= 1}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 disabled:opacity-40"
                >
                  Sebelumnya
                </button>
                <button
                  type="button" onClick={() => setHalaman((h) => h + 1)} disabled={halaman >= totalHalaman}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 disabled:opacity-40"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <FormAlat
        terbuka={formTerbuka}
        alat={sedangEdit}
        kategori={kategori.data?.data ?? []}
        ruangan={ruangan.data?.data ?? []}
        onTutup={() => setFormTerbuka(false)}
        onSimpan={() => { setFormTerbuka(false); muatUlang(); }}
      />

      <DialogImporExcel
        terbuka={imporTerbuka}
        onTutup={() => setImporTerbuka(false)}
        onSelesai={muatUlang}
        judul="Impor Data Alat dari Excel"
        kolom={KOLOM_ALAT}
        kolomWajib={KOLOM_WAJIB}
        namaTemplat="templat-data-alat.xlsx"
        buatTemplat={buatTemplatAlat}
        bacaBaris={bacaBarisAlat}
        maksBaris={300}
        kolomPratinjau={[
          { kunci: 'kode_alat', label: 'Kode' },
          { kunci: 'nama_alat', label: 'Nama Alat' },
          { kunci: 'kategori', label: 'Kategori' },
          { kunci: 'ruangan', label: 'Ruangan' },
          { kunci: 'jumlah_baik', label: 'Baik' },
          { kunci: 'jumlah_rusak', label: 'Rusak' },
          { kunci: 'boleh_dipinjam', label: 'Dipinjamkan', tampil: (v) => (v ? 'Ya' : 'Tidak') },
        ]}
        petunjuk={
          <p className="mt-2">
            Kolom <span className="font-mono text-xs">Kategori</span> dan{' '}
            <span className="font-mono text-xs">Ruangan</span> diisi{' '}
            <strong>namanya</strong>, persis seperti yang terdaftar di menu Kategori dan
            Ruangan. Nama yang belum terdaftar akan dilaporkan sebagai baris gagal —
            tidak dibuatkan otomatis, supaya salah ketik tidak melahirkan kategori baru.
          </p>
        }
        kirim={(b) => api.post('/alat/impor', { baris: b }, { batasWaktuMs: 300_000 })}
      />

      <KonfirmasiHapus
        terbuka={!!akanDihapus}
        judul="Hapus alat"
        keterangan={
          akanDihapus
            ? `"${akanDihapus.nama_alat}" akan dihapus dari inventaris. Tindakan ini tidak bisa dibatalkan.`
            : ''
        }
        onTutup={() => setAkanDihapus(null)}
        onKonfirmasi={async () => {
          await api.delete(`/alat/${akanDihapus.id}`);
          muatUlang();
        }}
      />
    </div>
  );
}

function TabelAlat({ daftar, onEdit, onHapus }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-5 py-3">Kode</th>
            <th className="px-5 py-3">Nama Alat</th>
            <th className="px-5 py-3">Kategori</th>
            <th className="px-5 py-3">Ruangan</th>
            <th className="px-5 py-3 text-center">Baik</th>
            <th className="px-5 py-3 text-center">Rusak</th>
            <th className="px-5 py-3 text-center">Dipinjam</th>
            <th className="px-5 py-3 text-center">Tersedia</th>
            <th className="px-5 py-3 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {daftar.map((alat) => (
            <tr key={alat.id} className="hover:bg-slate-50">
              <td className="px-5 py-3 font-mono text-xs text-slate-500">{alat.kode_alat}</td>
              <td className="px-5 py-3">
                <p className="font-medium text-ink-900">{alat.nama_alat}</p>
                <p className="text-xs text-slate-400">
                  {[alat.merk_tipe, alat.tahun_perolehan].filter(Boolean).join(' · ') || '—'}
                  {!alat.boleh_dipinjam && (
                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                      tidak dipinjamkan
                    </span>
                  )}
                </p>
              </td>
              <td className="px-5 py-3 text-slate-600">{alat.kategori?.nama_kategori || '-'}</td>
              <td className="px-5 py-3 text-slate-600">{alat.ruangan?.nama_ruangan || '-'}</td>
              <td className="px-5 py-3 text-center text-slate-600">{alat.jumlah_baik}</td>
              <td className={`px-5 py-3 text-center ${alat.jumlah_rusak > 0 ? 'font-semibold text-amber-600' : 'text-slate-400'}`}>
                {alat.jumlah_rusak}
              </td>
              <td className="px-5 py-3 text-center text-slate-600">{alat.jumlah_dipinjam}</td>
              <td className="px-5 py-3 text-center">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  alat.jumlah_tersedia > 0 ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {alat.jumlah_tersedia}
                </span>
              </td>
              <td className="px-5 py-3">
                {/* aria-label, bukan hanya title: title cuma muncul saat
                    kursor berhenti di atas tombol, jadi di layar sentuh
                    kedua ikon ini tidak punya nama sama sekali -- termasuk
                    bagi pembaca layar. Ukurannya dinaikkan ke 40px supaya
                    nyaman disentuh dan tombol hapus tidak mudah tersenggol. */}
                <div className="flex justify-end gap-1">
                  <button
                    type="button" onClick={() => onEdit(alat)}
                    title="Edit alat" aria-label={`Edit ${alat.nama_alat}`}
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-brand-700"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button" onClick={() => onHapus(alat)}
                    title="Hapus alat" aria-label={`Hapus ${alat.nama_alat}`}
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FormAlat({ terbuka, alat, kategori, ruangan, onTutup, onSimpan }) {
  const [form, setForm] = useState(FORM_KOSONG);
  const [galat, setGalat] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);
  const [idTerakhir, setIdTerakhir] = useState(null);

  // Foto yang sudah tersimpan di database saat formulir dibuka. Dipakai
  // membedakan mana unggahan baru yang boleh dibuang saat dibatalkan.
  const [fotoAwal, setFotoAwal] = useState('');

  // Isian disamakan dengan baris yang sedang dibuka tanpa perlu efek
  // tambahan: cukup bandingkan penanda barisnya saat render.
  const penanda = terbuka ? (alat?.id ?? 'baru') : null;
  if (penanda !== idTerakhir) {
    setIdTerakhir(penanda);
    setGalat('');
    setForm(alat ? keIsianForm(alat) : FORM_KOSONG);
    setFotoAwal(alat?.foto_url || '');
  }

  function ubah(kunci) {
    return (e) => {
      const nilai = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      setForm((f) => ({ ...f, [kunci]: nilai }));
    };
  }

  /**
   * Foto sudah terunggah sebelum formulir disimpan, jadi berkas yang batal
   * dipakai dibersihkan di sini. Yang boleh dihapus hanya unggahan baru —
   * foto yang sudah tersimpan di database baru dilepas setelah penyimpanan
   * berhasil, supaya data lama tidak hilang kalau penyimpanan gagal.
   */
  function gantiFoto(urlBaru) {
    const sebelumnya = form.foto_url;
    if (sebelumnya && sebelumnya !== fotoAwal) hapusFotoAlat(sebelumnya);
    setForm((f) => ({ ...f, foto_url: urlBaru || '' }));
  }

  function batal() {
    if (form.foto_url && form.foto_url !== fotoAwal) hapusFotoAlat(form.foto_url);
    onTutup();
  }

  async function simpan(e) {
    e.preventDefault();
    setGalat('');
    setMenyimpan(true);

    const payload = {
      ...form,
      jumlah_baik: Number(form.jumlah_baik),
      jumlah_rusak: Number(form.jumlah_rusak),
      tahun_perolehan: form.tahun_perolehan === '' ? null : Number(form.tahun_perolehan),
      harga_satuan: form.harga_satuan === '' ? null : Number(form.harga_satuan),
    };

    try {
      if (alat) await api.put(`/alat/${alat.id}`, payload);
      else await api.post('/alat', payload);

      // Foto lama baru dilepas setelah data tersimpan.
      if (fotoAwal && fotoAwal !== form.foto_url) hapusFotoAlat(fotoAwal);

      onSimpan();
    } catch (err) {
      setGalat(err.message);
    } finally {
      setMenyimpan(false);
    }
  }

  const totalUnit = (Number(form.jumlah_baik) || 0) + (Number(form.jumlah_rusak) || 0);

  return (
    <Modal
      terbuka={terbuka}
      judul={alat ? `Edit ${alat.nama_alat}` : 'Tambah Alat'}
      onTutup={batal}
      lebar="max-w-2xl"
    >
      <form onSubmit={simpan} className="space-y-4">
        <PesanGalat pesan={galat} />

        <div className="grid gap-4 sm:grid-cols-3">
          <Isian label="Kode alat" wajib>
            <input
              required maxLength={50} value={form.kode_alat} onChange={ubah('kode_alat')}
              className="input font-mono" placeholder="LAB-IPA-001"
            />
          </Isian>
          <div className="sm:col-span-2">
            <Isian label="Nama alat" wajib>
              <input
                required maxLength={150} value={form.nama_alat} onChange={ubah('nama_alat')}
                className="input" placeholder="Mikroskop Binokuler"
              />
            </Isian>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Isian label="Kategori">
            <select value={form.kategori_id} onChange={ubah('kategori_id')} className="input">
              <option value="">Belum ditentukan</option>
              {kategori.map((k) => <option key={k.id} value={k.id}>{k.nama_kategori}</option>)}
            </select>
          </Isian>
          <Isian label="Ruangan penyimpanan">
            <select value={form.ruangan_id} onChange={ubah('ruangan_id')} className="input">
              <option value="">Belum ditentukan</option>
              {ruangan.map((r) => <option key={r.id} value={r.id}>{r.nama_ruangan}</option>)}
            </select>
          </Isian>
        </div>

        <fieldset className="rounded-xl border border-slate-200 p-4">
          <legend className="px-1 text-xs font-semibold text-slate-600">Jumlah unit</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <Isian label="Layak pakai" wajib>
              <input
                required type="number" min={0} value={form.jumlah_baik}
                onChange={ubah('jumlah_baik')} className="input"
              />
            </Isian>
            <Isian label="Rusak">
              <input
                type="number" min={0} value={form.jumlah_rusak}
                onChange={ubah('jumlah_rusak')} className="input"
              />
            </Isian>
            <div className="flex flex-col justify-end pb-2">
              <p className="text-xs text-slate-500">Total unit</p>
              <p className="font-display text-lg font-bold text-ink-900">{totalUnit}</p>
            </div>
          </div>
          {alat && alat.jumlah_dipinjam > 0 && (
            <p className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
              {alat.jumlah_dipinjam} unit sedang dipinjam. Jumlah layak pakai tidak bisa
              diturunkan di bawah angka itu sampai alatnya dikembalikan.
            </p>
          )}
        </fieldset>

        <fieldset className="rounded-xl border border-slate-200 p-4">
          <legend className="px-1 text-xs font-semibold text-slate-600">Data perolehan (opsional)</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Isian label="Merk / tipe">
              <input maxLength={120} value={form.merk_tipe} onChange={ubah('merk_tipe')} className="input" />
            </Isian>
            <Isian label="Nomor seri">
              <input maxLength={120} value={form.nomor_seri} onChange={ubah('nomor_seri')} className="input" />
            </Isian>
            <Isian label="Tahun perolehan">
              <input
                type="number" min={1950} max={2100} value={form.tahun_perolehan}
                onChange={ubah('tahun_perolehan')} className="input" placeholder="2024"
              />
            </Isian>
            <Isian label="Sumber dana">
              <select value={form.sumber_dana} onChange={ubah('sumber_dana')} className="input">
                <option value="">Belum ditentukan</option>
                {SUMBER_DANA.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Isian>
            <div className="sm:col-span-2">
              <Isian label="Harga satuan (Rp)">
                <input
                  type="number" min={0} step="1000" value={form.harga_satuan}
                  onChange={ubah('harga_satuan')} className="input" placeholder="1500000"
                />
              </Isian>
              {form.harga_satuan !== '' && totalUnit > 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  Nilai seluruh unit: {rupiah(Number(form.harga_satuan) * totalUnit)}
                </p>
              )}
            </div>
          </div>
        </fieldset>

        <UnggahFoto nilai={form.foto_url} onChange={gantiFoto} mati={menyimpan} />

        <Isian label="Keterangan">
          <textarea
            rows={2} maxLength={2000} value={form.deskripsi} onChange={ubah('deskripsi')}
            className="input" placeholder="Catatan kondisi, kelengkapan, atau cara penyimpanan"
          />
        </Isian>

        <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
          <input
            type="checkbox" checked={form.boleh_dipinjam} onChange={ubah('boleh_dipinjam')}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm text-slate-700">
            Boleh dipinjam keluar
            <span className="block text-xs text-slate-500">
              Matikan untuk alat yang hanya dipakai di dalam lab, misalnya bahan kimia.
            </span>
          </span>
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button" onClick={batal}
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

/**
 * Mengambil hanya kolom yang ada di formulir, dan mengganti null dengan
 * string kosong karena input HTML tidak bisa menampung null.
 *
 * Baris dari API juga membawa relasi (kategori, ruangan) serta kolom
 * terhitung seperti jumlah_total — semuanya tidak ikut ke formulir.
 */
function keIsianForm(alat) {
  return Object.fromEntries(
    Object.keys(FORM_KOSONG).map((kunci) => [kunci, alat[kunci] ?? FORM_KOSONG[kunci]])
  );
}

function Isian({ label, wajib, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">
        {label} {wajib && <span className="text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}
