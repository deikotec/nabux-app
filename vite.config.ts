import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

const YEAR = 365 * 24 * 60 * 60;

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // PWA: el service worker guarda la app completa en el dispositivo para que abra y navegue sin internet.
    // Los datos ya funcionan sin conexión gracias a la caché persistente de Firestore (src/lib/firebase.ts).
    VitePWA({
      // "prompt": la nueva versión espera a que el usuario la acepte (no recarga a mitad de una venta).
      registerType: 'prompt',
      injectRegister: false,
      // El manifest vive en public/manifest.webmanifest.
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,woff2}'],
        globIgnores: ['og-image.png', 'screenshots/**'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: 'index.html',
        // Rutas reservadas de Firebase Hosting (/__/auth/handler, /__/firebase/init.json…).
        navigateFallbackDenylist: [/^\/__\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' }
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: YEAR },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            // Fotos de productos, logos y avatares: se ven también sin conexión.
            urlPattern: ({ url, request }) =>
              request.destination === 'image' &&
              (url.hostname === 'firebasestorage.googleapis.com' || url.hostname.endsWith('.googleusercontent.com')),
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  build: {
    chunkSizeWarningLimit: 1200
  }
});
