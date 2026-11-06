import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    // HMR is disabled for presentation stability: no websocket noise in the
    // console and no surprise reloads mid-demonstration. Refresh to see edits.
    hmr: false,
  },
  preview: { host: '0.0.0.0', port: 5173, strictPort: true, allowedHosts: true },
});
