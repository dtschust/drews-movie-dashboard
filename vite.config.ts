import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const normalizedFlag = env.IS_EMBEDDED?.toLowerCase();
  const envIsEmbedded =
    normalizedFlag === 'true' || normalizedFlag === '1' || normalizedFlag === 'yes'
      ? true
      : normalizedFlag === 'false' || normalizedFlag === '0' || normalizedFlag === 'no'
        ? false
        : undefined;
  const modeIsEmbedded = mode === 'embedded' ? true : mode === 'web' ? false : undefined;
  const isEmbedded = modeIsEmbedded ?? envIsEmbedded ?? false;

  const plugins = [react()];
  if (isEmbedded) {
    plugins.push(viteSingleFile());
  }

  return {
    base: './',
    plugins,
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    build: {
      outDir: isEmbedded ? 'dist/embedded' : 'dist/web',
      ...(isEmbedded
        ? {
            rollupOptions: {
              output: {
                format: 'es',
                inlineDynamicImports: true,
                entryFileNames: 'assets/bundle.js',
              },
            },
          }
        : {}),
    },
    define: {
      'import.meta.env.IS_EMBEDDED': JSON.stringify(isEmbedded),
    },
  };
});
