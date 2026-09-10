import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export default function TidakDitemukan() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <Compass size={40} className="text-slate-300" />
      <h1 className="font-display mt-4 text-2xl font-bold text-ink-900">Halaman tidak ditemukan</h1>
      <p className="mt-2 text-sm text-slate-500">
        Alamat yang Anda buka tidak ada. Mungkin tautannya salah ketik atau halamannya sudah dipindahkan.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
      >
        Kembali ke katalog alat
      </Link>
    </div>
  );
}
