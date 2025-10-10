import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: './',
    plugins: [react(), viteSingleFile()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          format: 'es',
          inlineDynamicImports: true,
          entryFileNames: 'assets/bundle.js',
        },
      },
    },
    define: {
      'import.meta.env.IS_EMBEDDED': JSON.stringify(env.IS_EMBEDDED ?? ''),
    },
  };
});
