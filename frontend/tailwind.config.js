/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Palet utama diturunkan dari lambang SMP Negeri 3 Kedungreja:
        // hijau daun #70c060 dan hijau tua karangan #308050.
        //
        // Nilai 500 sengaja dibuat cukup gelap (kontras 5.0 terhadap putih)
        // karena dipakai sebagai warna dasar tombol bertulisan putih. Teal
        // yang dipakai sebelumnya hanya 3.0 — di bawah ambang keterbacaan
        // 4.5 yang dianjurkan, dan terasa pucat di layar proyektor kelas.
        brand: {
          50: '#f0f9ef',
          100: '#dcf1d9',
          200: '#b8e3b3',
          300: '#8ace83',
          400: '#55b04f',
          500: '#24802f',
          600: '#1d6a27',
          700: '#185621',
          800: '#14451b',
          900: '#113a18',
        },
        // Emas medali pada lambang, untuk aksen sesekali.
        emas: {
          100: '#f5ecd8',
          500: '#b09060',
          700: '#836a44',
        },
        ink: {
          900: '#0b1220',
          800: '#121b2e',
          700: '#1b2740',
        },
      },
      fontFamily: {
        display: ['"Sora"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
