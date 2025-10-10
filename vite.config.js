import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        format: 'es',
        inlineDynamicImports: true,
        entryFileNames: 'assets/bundle.js',
      },
    },
  },
});
