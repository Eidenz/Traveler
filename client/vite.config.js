// client/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Stamp the service worker's CACHE_NAME with a unique id per build so every
// deploy invalidates the previous caches without a manual version bump.
const injectSwBuildId = () => ({
  name: 'inject-sw-build-id',
  apply: 'build',
  closeBundle() {
    const swPath = path.resolve(__dirname, 'dist/serviceWorker.js');
    if (!fs.existsSync(swPath)) return;
    const buildId = Date.now().toString(36);
    fs.writeFileSync(
      swPath,
      fs.readFileSync(swPath, 'utf8').replaceAll('__BUILD_ID__', buildId)
    );
  },
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), injectSwBuildId()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true, // Enable WebSocket proxying
      },
    },
  },
});