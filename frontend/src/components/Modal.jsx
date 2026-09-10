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

  useEffect(() => {
    if (!terbuka) return undefined;

    function tekanTombol(e) {
      if (e.key === 'Escape') onTutup();
    }

    const gulirSemula = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', tekanTombol);
    kotakRef.current?.focus();

    return () => {
      document.body.style.overflow = gulirSemula;
      document.removeEventListener('keydown', tekanTombol);
    };
  }, [terbuka, onTutup]);

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
