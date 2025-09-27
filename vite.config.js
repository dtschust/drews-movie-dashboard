import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

// GitHub Pages base path (repo name). Adjust if deploying to a different path.
const base = '/drews-movie-dashboard/';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
