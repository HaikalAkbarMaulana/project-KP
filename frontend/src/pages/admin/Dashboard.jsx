import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Boxes, PackageCheck, Wrench, Wallet, Activity, AlertTriangle, Clock, ArrowRight, CalendarRange,
} from 'lucide-react';

import StatCard from '../../components/StatCard';
import { useAmbilData } from '../../hooks/useAmbilData';
import { Memuat, PesanGalat, Kosong } from '../../components/Keadaan';
import { angka, rupiah, waktuLengkap } from '../../lib/format';

// Diambil dari palet brand di tailwind.config.js. Recharts menggambar ke
// SVG dengan warna harfiah, jadi nilainya tidak bisa memakai kelas Tailwind.
const HIJAU = '#24802f';
const AMBER = '#d97706';
const ABU_GARIS = '#e2e8f0';
const ABU_TEKS = '#94a3b8';

const WARNA_KONDISI = [HIJAU, AMBER];

const GAYA_TOOLTIP = {
  borderRadius: 12,
  border: `1px solid ${ABU_GARIS}`,
  fontSize: 13,
  boxShadow: '0 4px 12px rgb(15 23 42 / 0.08)',
};

/**
 * Membandingkan jumlah peminjaman bulan ini dengan bulan sebelumnya.
 *
 * Hanya angka inilah yang punya pembanding sungguhan — data bulanan memang
 * disimpan. Kartu lain seperti unit rusak tidak diberi tren karena
 * aplikasi tidak menyimpan potret stok harian.
 */
function hitungTren(perBulan) {
  if (!perBulan || perBulan.length < 2) return null;

  const iniBulan = perBulan[perBulan.length - 1].jumlah;
  const bulanLalu = perBulan[perBulan.length - 2].jumlah;
  const selisih = iniBulan - bulanLalu;

  if (selisih === 0) {
    return { arah: 'sama', nilai: 'tetap', keterangan: `Sama dengan bulan lalu (${bulanLalu})` };
  }
  return {
    arah: selisih > 0 ? 'naik' : 'turun',
    nilai: `${selisih > 0 ? '+' : ''}${selisih}`,
    keterangan: `Bulan lalu ${bulanLalu} pengajuan`,
  };
}

export default function Dashboard() {
  const { data, memuat, galat, muatUlang } = useAmbilData('/dashboard/ringkasan');

  if (memuat) return <Memuat pesan="Menyiapkan ringkasan..." />;
  if (galat) return <PesanGalat pesan={galat} onCobaLagi={muatUlang} />;

  const r = data.data;
  const tren = hitungTren(r.peminjamanPerBulan);
  const peminjamanBulanIni = r.peminjamanPerBulan?.at(-1)?.jumlah ?? 0;

  return (
    <div className="space-y-6">
      {(r.menungguPersetujuan > 0 || r.terlambatDikembalikan > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {r.menungguPersetujuan > 0 && (
            <KartuTindakan
              ikon={Clock}
              warna="amber"
              judul={`${r.menungguPersetujuan} pengajuan menunggu ditinjau`}
              keterangan="Guru sedang menunggu keputusan Anda."
              ke="/admin/peminjaman?status=pending"
            />
          )}
          {r.terlambatDikembalikan > 0 && (
            <KartuTindakan
              ikon={AlertTriangle}
              warna="rose"
              judul={`${r.terlambatDikembalikan} alat terlambat dikembalikan`}
              keterangan="Sudah lewat tanggal rencana kembali."
              ke="/admin/peminjaman?terlambat=1"
            />
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          ikon={Boxes} label="Jenis alat" nilai={angka(r.totalJenisAlat)}
          catatan={`${angka(r.totalUnit)} unit seluruhnya`} warna="brand"
        />
        <StatCard
          ikon={PackageCheck} label="Siap dipinjam" nilai={angka(r.unitTersedia)} satuan="unit"
          catatan={`${angka(r.unitDipinjam)} unit sedang dipinjam`} warna="sky"
        />
        <StatCard
          ikon={CalendarRange} label="Pengajuan bulan ini"
          nilai={angka(peminjamanBulanIni)}
          tren={tren}
          catatan="Belum ada pembanding bulan lalu"
          warna="brand"
        />
        <StatCard
          ikon={Wrench} label="Unit rusak" nilai={angka(r.unitRusak)} satuan="unit"
          catatan="Perlu perbaikan atau penghapusan" warna="amber"
        />
        <StatCard
          ikon={Wallet} label="Nilai aset" nilai={rupiah(r.nilaiAset)}
          catatan="Dari alat yang sudah diisi harganya" warna="slate"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel judul="Peminjaman 6 bulan terakhir" kelas="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={r.peminjamanPerBulan} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                {/* Gradasi tipis agar batang tidak terlihat sebagai blok datar. */}
                <linearGradient id="gradasiBatang" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={HIJAU} />
                  <stop offset="100%" stopColor={HIJAU} stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={ABU_GARIS} vertical={false} />
              <XAxis dataKey="nama" tick={{ fontSize: 12 }} stroke={ABU_TEKS} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} stroke={ABU_TEKS} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: 'rgb(36 128 47 / 0.06)' }}
                formatter={(nilai) => [`${nilai} pengajuan`, '']}
                contentStyle={GAYA_TOOLTIP}
              />
              <Bar dataKey="jumlah" fill="url(#gradasiBatang)" radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel judul="Kondisi unit inventaris">
          {r.totalUnit === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Belum ada data alat.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={r.kondisiUnit} dataKey="jumlah" nameKey="nama"
                  innerRadius={58} outerRadius={88} paddingAngle={3} stroke="#ffffff" strokeWidth={2}
                >
                  {r.kondisiUnit.map((entri, i) => (
                    <Cell key={entri.nama} fill={WARNA_KONDISI[i % WARNA_KONDISI.length]} />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 13 }} />
                <Tooltip
                  formatter={(nilai, nama) => [`${angka(nilai)} unit`, nama]}
                  contentStyle={GAYA_TOOLTIP}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel judul="Alat paling sering dipinjam">
          {r.alatSeringDipinjam.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              Belum ada peminjaman dalam 6 bulan terakhir.
            </p>
          ) : (
            <ol className="space-y-3">
              {r.alatSeringDipinjam.map((alat, i) => (
                <li key={alat.nama} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-900">{alat.nama}</span>
                  <span className="shrink-0 text-sm font-semibold text-slate-500">
                    {angka(alat.jumlah)} unit
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel judul="Aktivitas terbaru" ikon={Activity}>
          {r.logTerbaru.length === 0 ? (
            <Kosong judul="Belum ada aktivitas" keterangan="Catatan akan muncul di sini setelah ada perubahan data." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {r.logTerbaru.map((log) => (
                <li key={log.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                  <div className="min-w-0">
                    <p className="text-sm text-ink-900">{log.keterangan || log.aksi}</p>
                    <p className="text-xs text-slate-400">
                      {log.aktor_nama || 'Sistem'} · {waktuLengkap(log.dibuat_pada)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Panel({ judul, ikon: Ikon, kelas = '', children }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${kelas}`}>
      <div className="mb-4 flex items-center gap-2">
        {Ikon && <Ikon size={18} className="text-brand-600" />}
        <h2 className="font-display text-base font-bold text-ink-900">{judul}</h2>
      </div>
      {children}
    </section>
  );
}

function KartuTindakan({ ikon: Ikon, warna, judul, keterangan, ke }) {
  const gaya = {
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    rose: 'border-rose-200 bg-rose-50 text-rose-900',
  }[warna];

  return (
    <Link
      to={ke}
      className={`flex items-center gap-4 rounded-2xl border p-4 transition-shadow hover:shadow-sm ${gaya}`}
    >
      <Ikon size={22} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-bold">{judul}</p>
        <p className="text-xs opacity-80">{keterangan}</p>
      </div>
      <ArrowRight size={18} className="shrink-0 opacity-60" />
    </Link>
  );
}
