import { useEffect, useState } from 'react';

/**
 * Menunda perubahan nilai selama beberapa saat.
 *
 * Dipakai kotak pencarian: tanpa ini setiap ketikan huruf memicu satu
 * permintaan ke server, sehingga mengetik "mikroskop" menembak API sembilan
 * kali dan balasannya bisa datang tidak berurutan.
 */
export function useTundaNilai(nilai, jeda = 350) {
  const [tertunda, setTertunda] = useState(nilai);

  useEffect(() => {
    const pewaktu = setTimeout(() => setTertunda(nilai), jeda);
    return () => clearTimeout(pewaktu);
  }, [nilai, jeda]);

  return tertunda;
}
