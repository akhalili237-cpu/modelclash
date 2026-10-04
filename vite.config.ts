import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  // Serve through the sandbox preview gateway and any static host.
  server: { host: true, port: 3000, strictPort: true, allowedHosts: true },
  preview: { host: true, port: 3000, strictPort: true, allowedHosts: true },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        id: '/',
        name: 'ModelClash — Free AI Arena',
        short_name: 'ModelClash',
        description:
          'Blind-battle free AI models, run tournaments, climb your own ELO leaderboard. No login, no API keys, no setup.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0a0a0f',
        theme_color: '#0a0a0f',
        lang: 'en',
        categories: ['productivity', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
        shortcuts: [
          { name: 'Direct Chat', short_name: 'Chat', url: './#chat', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Blind Battle', short_name: 'Battle', url: './#battle', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Leaderboard', short_name: 'Ranks', url: './#leaderboard', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // web-llm engine chunks are ~6 MB; precache them so local WebGPU
        // models keep working offline (model weights are cached separately
        // by the web-llm runtime in Cache Storage).
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/image\.pollinations\.ai\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mc-images',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
        },
      },
    },
  },
});
