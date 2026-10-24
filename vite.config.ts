import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png', 'fonts/*'],
      manifest: {
        name: 'Smart Studio Presenter Pro',
        short_name: 'SmartStudio',
        description: 'Fullscreen 4K Teaching & Presentation Studio for Educators (SSIRO Classes)',
        theme_color: '#0A1633',
        background_color: '#0A1633',
        display: 'fullscreen',
        orientation: 'landscape',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        cacheId: 'ssiro-smart-studio-v1.2.0',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wasm}']
      }
    })
  ],
  server: {
    port: 5173,
    host: true
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 4096
  }
});
