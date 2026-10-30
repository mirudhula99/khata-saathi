import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Dev:   `npm run dev` here + his FastAPI on :8000 (`run-windows.cmd` or uvicorn). Everything but the app itself is proxied.
// Build: `npm run build` writes to ../static/app, which app/main.py serves at "/" (SPA fallback for /khata, /reminders ...).
// Assets are served by his StaticFiles mount at /static, hence base = /static/app/.
export default defineConfig({
  base: '/static/app/',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: { outDir: '../static/app', emptyOutDir: true },
  server: {
    port: 5173,
    proxy: Object.fromEntries(
      ['/api', '/static', '/audio', '/webhooks', '/customer', '/pay', '/join', '/manifest.webmanifest', '/sw.js', '/legacy']
        .map((p) => [p, { target: 'http://localhost:8000', changeOrigin: true }]),
    ),
  },
});
