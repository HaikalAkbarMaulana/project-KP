import { useState } from 'react';
import { Plus, Trash2, ShieldCheck, ShieldOff, Info } from 'lucide-react';

import { api } from '../../lib/api';
import { useAmbilData } from '../../hooks/useAmbilData';
import { useAuth } from '../../context/AuthContext';
import { tanggalSingkat } from '../../lib/format';
import Modal from '../../components/Modal';
import KonfirmasiHapus from '../../components/KonfirmasiHapus';
import { Memuat, PesanGalat, Kosong } from '../../components/Keadaan';

const FORM_KOSONG = { nama: '', email: '', jabatan: '', no_hp: '', password: '' };

export default function AkunAdmin() {
  const { admin: sayaSendiri } = useAuth();
  const { data, memuat, galat, muatUlang } = useAmbilData('/admin/pengguna');
  const daftar = data?.data ?? [];

  const [formTerbuka, setFormTerbuka] = useState(false);
  const [akanDihapus, setAkanDihapus] = useState(null);
  const [galatAksi, setGalatAksi] = useState('');

  async function ubahAktif(orang) {
    setGalatAksi('');
    try {
      await api.patch(`/admin/pengguna/${orang.id}`, { aktif: !orang.aktif });
      muatUlang();
    } catch (err) {
      setGalatAksi(err.message);
    }
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-900">Akun Admin</h1>
          <p className="text-sm text-slate-500">
            Daftar petugas lab yang boleh masuk ke panel ini.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormTerbuka(true)}
          className="flex items-center gap-2 self-start rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
        >
          <Plus size={18} /> Tambah Admin
        </button>
      </div>

      <p className="flex gap-2 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
        <Info size={16} className="mt-px shrink-0" />
        <span>
          Hanya orang di daftar ini yang bisa masuk. Guru tidak perlu akun —
          mereka mengajukan peminjaman lewat halaman publik.
        </span>
      </p>

      <PesanGalat pesan={galatAksi} />
      <PesanGalat pesan={galat} onCobaLagi={muatUlang} />

      {galat ? null : memuat ? (
        <Memuat />
      ) : daftar.length === 0 ? (
        <Kosong judul="Belum ada akun admin" keterangan="Tambahkan petugas lab lewat tombol di atas." />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {daftar.map((orang) => {
            const iniSaya = orang.id === sayaSendiri?.id;

            return (
              <li key={orang.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                    orang.aktif ? 'bg-brand-500' : 'bg-slate-300'
                  }`}
                >
                  {orang.nama[0]?.toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-ink-900">
                    {orang.nama}
                    {iniSaya && (
                      <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700">
                        Anda
                      </span>
                    )}
                    {!orang.aktif && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">
                        Nonaktif
                      </span>
                    )}
                  </p>
                  <p className="truncate text-sm text-slate-500">{orang.email}</p>
                  <p className="text-xs text-slate-400">
                    {[orang.jabatan, orang.no_hp].filter(Boolean).join(' · ')}
                    {orang.jabatan || orang.no_hp ? ' · ' : ''}
                    Ditambahkan {tanggalSingkat(orang.dibuat_pada)}
                  </p>
                </div>

                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => ubahAktif(orang)}
                    disabled={iniSaya}
                    title={
                      iniSaya
                        ? 'Tidak bisa menonaktifkan akun sendiri'
                        : orang.aktif ? 'Nonaktifkan akses' : 'Aktifkan kembali'
                    }
                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    {orang.aktif ? <ShieldOff size={16} /> : <ShieldCheck size={16} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAkanDihapus(orang)}
                    disabled={iniSaya}
                    title={iniSaya ? 'Tidak bisa menghapus akun sendiri' : 'Hapus akun'}
                    className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <FormAdmin
        terbuka={formTerbuka}
        onTutup={() => setFormTerbuka(false)}
        onSimpan={() => { setFormTerbuka(false); muatUlang(); }}
      />

      <KonfirmasiHapus
        terbuka={!!akanDihapus}
        judul="Hapus akun admin"
        keterangan={
          akanDihapus
            ? `Akun ${akanDihapus.nama} (${akanDihapus.email}) akan dihapus permanen dan tidak bisa dipakai masuk lagi. ` +
              'Kalau hanya ingin mencabut akses sementara, pakai tombol nonaktifkan.'
            : ''
        }
        onTutup={() => setAkanDihapus(null)}
        onKonfirmasi={async () => {
          await api.delete(`/admin/pengguna/${akanDihapus.id}`);
          muatUlang();
        }}
      />
    </div>
  );
}

function FormAdmin({ terbuka, onTutup, onSimpan }) {
  const [form, setForm] = useState(FORM_KOSONG);
  const [galat, setGalat] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);
  const [pernahTerbuka, setPernahTerbuka] = useState(false);

  if (terbuka !== pernahTerbuka) {
    setPernahTerbuka(terbuka);
    if (terbuka) { setForm(FORM_KOSONG); setGalat(''); }
  }

  function ubah(kunci) {
    return (e) => setForm((f) => ({ ...f, [kunci]: e.target.value }));
  }

  async function simpan(e) {
    e.preventDefault();
    setGalat('');
    setMenyimpan(true);
    try {
      await api.post('/admin/pengguna', form);
      onSimpan();
    } catch (err) {
      setGalat(err.message);
    } finally {
      setMenyimpan(false);
    }
  }

  return (
    <Modal terbuka={terbuka} judul="Tambah akun admin" onTutup={onTutup} lebar="max-w-lg">
      <form onSubmit={simpan} className="space-y-4">
        <PesanGalat pesan={galat} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Isian label="Nama lengkap" wajib>
            <input required maxLength={120} value={form.nama} onChange={ubah('nama')} className="input" />
          </Isian>
          <Isian label="Jabatan">
            <input
              maxLength={100} value={form.jabatan} onChange={ubah('jabatan')}
              className="input" placeholder="Kepala Lab IPA"
            />
          </Isian>
        </div>

        <Isian label="Email" wajib>
          <input
            required type="email" autoComplete="off" value={form.email} onChange={ubah('email')}
            className="input" placeholder="petugas@sekolah.sch.id"
          />
        </Isian>

        <Isian label="Nomor HP">
          <input
            type="tel" maxLength={20} value={form.no_hp} onChange={ubah('no_hp')}
            className="input" placeholder="08xxxxxxxxxx"
          />
        </Isian>

        <Isian label="Kata sandi awal" wajib>
          <input
            required type="password" minLength={8} autoComplete="new-password"
            value={form.password} onChange={ubah('password')} className="input"
          />
          <span className="mt-1 block text-xs text-slate-400">
            Minimal 8 karakter. Sampaikan kata sandi ini langsung kepada yang bersangkutan,
            lalu minta ia menggantinya.
          </span>
        </Isian>

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
            {menyimpan ? 'Menyimpan...' : 'Tambah admin'}
          </button>
        </div>
      </form>
    </Modal>
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
