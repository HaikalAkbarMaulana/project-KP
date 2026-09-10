import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Backend memakai service role key sehingga seluruh aturan RLS dilewati.
// Konsekuensinya, pemeriksaan hak akses SEPENUHNYA menjadi tanggung jawab
// middleware wajibAdmin dan validasi di tiap route — jangan pernah
// mengekspor klien ini ke frontend.
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
