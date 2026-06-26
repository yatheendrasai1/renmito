import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['leaflet'],
  },
  build: {
    commonjsOptions: {
      include: [/leaflet/, /node_modules/],
    },
  },
  server: {
    port: 4200,
  },
});
