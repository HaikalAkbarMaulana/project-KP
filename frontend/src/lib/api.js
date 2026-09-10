import { supabase } from './supabaseClient';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export class GalatApi extends Error {
  constructor(pesan, status) {
    super(pesan);
    this.name = 'GalatApi';
    this.status = status;
  }
}

async function ambilToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}

async function permintaan(path, { metode = 'GET', data, signal } = {}) {
  const token = await ambilToken();

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: metode,
      signal,
      headers: {
        ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  } catch (err) {
    // Permintaan yang sengaja dibatalkan (komponen unmount / kata kunci
    // berubah) bukan kesalahan — biarkan pemanggilnya mengabaikannya.
    if (err.name === 'AbortError') throw err;
    throw new GalatApi(
      'Tidak bisa menghubungi server. Periksa koneksi internet, atau pastikan backend sedang berjalan.',
      0
    );
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    throw new GalatApi(body?.pesan || `Permintaan gagal (kode ${res.status}).`, res.status);
  }
  return body;
}

/** Mengunduh berkas dari endpoint terproteksi lalu menyimpannya di perangkat. */
async function unduh(path, namaBerkas) {
  const token = await ambilToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new GalatApi(body?.pesan || 'Gagal mengunduh berkas.', res.status);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const tautan = document.createElement('a');
  tautan.href = url;
  tautan.download = namaBerkas;
  document.body.appendChild(tautan);
  tautan.click();
  tautan.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  get: (path, opsi) => permintaan(path, opsi),
  post: (path, data, opsi) => permintaan(path, { ...opsi, metode: 'POST', data }),
  put: (path, data, opsi) => permintaan(path, { ...opsi, metode: 'PUT', data }),
  patch: (path, data, opsi) => permintaan(path, { ...opsi, metode: 'PATCH', data }),
  delete: (path, opsi) => permintaan(path, { ...opsi, metode: 'DELETE' }),
  unduh,
};

/** Menyusun query string, melewati nilai kosong. */
export function keQuery(objek) {
  const params = new URLSearchParams();
  for (const [kunci, nilai] of Object.entries(objek)) {
    if (nilai !== undefined && nilai !== null && nilai !== '') params.set(kunci, String(nilai));
  }
  const teks = params.toString();
  return teks ? `?${teks}` : '';
}
