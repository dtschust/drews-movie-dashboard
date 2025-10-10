import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const inlineCssPlugin = () => ({
  name: 'inline-css-into-js',
  apply: 'build',
  enforce: 'post',
  transformIndexHtml(html) {
    return html.replace(/\s*<link rel="stylesheet"[^>]*>\s*/g, '\n');
  },
  generateBundle(_options, bundle) {
    const jsChunk = Object.values(bundle).find(
      (chunk) => chunk.type === 'chunk' && chunk.fileName === 'assets/bundle.js',
    );

    if (!jsChunk) return;

    const cssEntries = Object.entries(bundle).filter(
      ([, value]) => value.type === 'asset' && value.fileName.endsWith('.css'),
    );

    if (cssEntries.length === 0) return;

    const css = cssEntries
      .map(([, asset]) => asset.source)
      .join('\n');

    jsChunk.code =
      "const styleSheet = document.createElement('style');\n" +
      "styleSheet.dataset.inline = 'bundle';\n" +
      `styleSheet.textContent = ${JSON.stringify(css)};\n` +
      'document.head.appendChild(styleSheet);\n' +
      jsChunk.code;

    for (const [fileName] of cssEntries) {
      delete bundle[fileName];
    }
  },
});

export default defineConfig({
  base: './',
  plugins: [react(), inlineCssPlugin()],
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
