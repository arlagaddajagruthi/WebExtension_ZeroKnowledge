import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { crx, type ManifestV3Export } from '@crxjs/vite-plugin';
import manifestJson from './manifest.json';

const manifest = manifestJson as ManifestV3Export;

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  build: {
    target: 'esnext',
    minify: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
