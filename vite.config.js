import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages base path (repo name). Adjust if deploying to a different path.
const base = '/drews-movie-dashboard/';

export default defineConfig({
  base,
  plugins: [react()],
});

