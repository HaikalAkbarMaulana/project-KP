import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

/**
 * Mengambil data dari API dengan tiga hal yang sebelumnya hilang:
 *
 *  1. Error ditangkap, bukan menjadi unhandled promise rejection yang
 *     menyisakan halaman kosong tanpa penjelasan.
 *  2. Permintaan lama dibatalkan saat path berubah atau komponen dilepas,
 *     supaya balasan yang datang terlambat tidak menimpa hasil terbaru.
 *  3. `muatUlang()` untuk menyegarkan setelah simpan/hapus.
 */
export function useAmbilData(path, { aktif = true } = {}) {
  const [keadaan, setKeadaan] = useState({ data: null, memuat: aktif, galat: '' });
  const [penanda, setPenanda] = useState(0);

  useEffect(() => {
    if (!aktif) {
      setKeadaan({ data: null, memuat: false, galat: '' });
      return undefined;
    }

    const kontrol = new AbortController();
    setKeadaan((sebelumnya) => ({ ...sebelumnya, memuat: true, galat: '' }));

    api.get(path, { signal: kontrol.signal })
      .then((res) => setKeadaan({ data: res, memuat: false, galat: '' }))
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setKeadaan({ data: null, memuat: false, galat: err.message });
      });

    return () => kontrol.abort();
  }, [path, aktif, penanda]);

  const muatUlang = useCallback(() => setPenanda((n) => n + 1), []);

  return { ...keadaan, muatUlang };
}
