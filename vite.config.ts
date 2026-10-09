import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { oklchToHexPlugin } from './scripts/oklch-to-hex.mjs';

export default defineConfig(({ mode }) => {
  // El APK (Capacitor) trae su propio WebView: allí no se registra ningún
  // service worker para que la app no dependa de la caché de la PWA.
  const isAndroid = mode === 'android';

  return {
    plugins: [
      react(),
      tailwindcss(),
      oklchToHexPlugin(),
      ...(isAndroid
        ? []
        : [
            VitePWA({
              registerType: 'autoUpdate',
              includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg'],
              manifest: {
                name: 'Docencia al Día - Gestión Universitaria',
                short_name: 'Docencia al Día',
                description:
                  'Sistema profesional para profesores: asistencia y notas offline.',
                theme_color: '#1e40af',
                background_color: '#ffffff',
                display: 'standalone',
                icons: [
                  {
                    src: 'pwa-192x192.png',
                    sizes: '192x192',
                    type: 'image/png',
                  },
                  {
                    src: 'pwa-512x512.png',
                    sizes: '512x512',
                    type: 'image/png',
                  },
                  {
                    src: 'pwa-512x512.png',
                    sizes: '512x512',
                    type: 'image/png',
                    purpose: 'any maskable',
                  },
                ],
              },
              // Las fuentes auto-hospedadas deben quedar en el precache para
              // que la app arranque 100% offline.
              workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
                maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
              },
              devOptions: {
                enabled: true,
              },
            }),
          ]),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
