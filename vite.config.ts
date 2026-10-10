import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Relative base so the build works on GitHub Pages under /<repo>/ as well as at a root domain.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Golf Tracker',
        short_name: 'Golf',
        description: 'Junior golf tournaments, practice, and per-shot stats',
        theme_color: '#14532d',
        background_color: '#f6f7f4',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        // Tour events change daily: try the network first, fall back to the last copy offline.
        runtimeCaching: [{ urlPattern: /events\.json$/, handler: 'NetworkFirst', options: { cacheName: 'tour-events' } }],
      },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts', 'scraper/**/*.test.ts'] },
});
