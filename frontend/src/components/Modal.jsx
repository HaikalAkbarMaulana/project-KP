import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Dialog sederhana yang bisa ditutup dengan tombol Esc atau klik di luar
 * kotak. Fokus dipindahkan ke dalam dialog saat terbuka, dan pengguliran
 * halaman di belakangnya dikunci supaya isian panjang tidak menggeser
 * latar.
 */
export default function Modal({ terbuka, judul, onTutup, children, lebar = 'max-w-lg' }) {
  const kotakRef = useRef(null);

  // onTutup disimpan di dalam ref, bukan dijadikan kebergantungan efek.
  //
  // Hampir semua pemanggil menuliskan onTutup sebagai fungsi yang dibuat di
  // dalam render, misalnya onTutup={batal}. Fungsi seperti itu beridentitas
  // baru setiap kali komponennya dirender ulang. Kalau identitasnya ikut
  // menjadi kebergantungan efek di bawah, maka setiap penekanan tombol di
  // dalam formulir -- yang memang mengubah state lalu memicu render ulang --
  // membuat efeknya dijalankan ulang, dan baris kotakRef.current.focus()
  // merebut fokus dari kolom yang sedang diketik.
  //
  // Gejalanya persis seperti yang dilaporkan: mengetik satu angka, fokus
  // lepas, lalu kolomnya harus diklik lagi untuk mengetik angka berikutnya.
  // Ini mengenai semua kolom isian di semua dialog, bukan hanya kolom angka.
  //
  // Dengan ref, isi terbarunya tetap terbaca saat Esc ditekan, tetapi efeknya
  // hanya berjalan sekali ketika dialog dibuka.
  const tutupRef = useRef(onTutup);
  tutupRef.current = onTutup;

  useEffect(() => {
    if (!terbuka) return undefined;

    function tekanTombol(e) {
      if (e.key === 'Escape') tutupRef.current();
    }

    const gulirSemula = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', tekanTombol);
    kotakRef.current?.focus();

    return () => {
      document.body.style.overflow = gulirSemula;
      document.removeEventListener('keydown', tekanTombol);
    };
  }, [terbuka]);

  if (!terbuka) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-ink-900/50 p-4 py-8 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onTutup(); }}
    >
      <div
        ref={kotakRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={judul}
        className={`w-full ${lebar} rounded-2xl bg-white p-6 shadow-xl outline-none`}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="font-display text-lg font-bold text-ink-900">{judul}</h2>
          <button
            type="button"
            onClick={onTutup}
            aria-label="Tutup"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-ink-900"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
