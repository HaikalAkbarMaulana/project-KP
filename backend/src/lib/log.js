import { supabaseAdmin } from '../supabaseClient.js';

/**
 * Mencatat aktivitas untuk ditampilkan di dashboard admin.
 *
 * Kegagalan pencatatan tidak boleh menggagalkan aksi utamanya — kalau
 * penyimpanan log bermasalah, penambahan alat tetap harus dianggap
 * berhasil. Karena itu error di sini hanya ditulis ke konsol server.
 */
export async function catatAktivitas({ admin, aksi, keterangan }) {
  const { error } = await supabaseAdmin.from('log_aktivitas').insert({
    aktor_id: admin?.id ?? null,
    aktor_nama: admin?.nama ?? 'Sistem',
    aksi,
    keterangan,
  });

  if (error) console.error('Gagal mencatat log aktivitas:', error.message);
}
