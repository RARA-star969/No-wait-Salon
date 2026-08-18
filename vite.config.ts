import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// The packaged Android bundles are loaded from the Capacitor WebView rather
// than a web server, so they need relative asset paths. Web deployments must
// use an absolute base: with './' a nested route such as /q/<token> resolves
// assets to /q/assets/..., which the SPA fallback answers with index.html, so
// the browser gets HTML where JavaScript was expected and renders a blank page.
const isCapacitorBundle =
  process.env.VITE_APP_MODE === 'customer' || process.env.VITE_APP_MODE === 'staff';

export default defineConfig(() => {
  return {
    base: isCapacitorBundle ? './' : '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      proxy: {
        '/api': process.env.DEV_API_PROXY || 'http://localhost:8787',
        '/profile-photos': process.env.DEV_API_PROXY || 'http://localhost:8787',
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
