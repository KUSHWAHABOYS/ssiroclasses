import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import os from 'os';

function networkInfoPlugin() {
  const handler = (_req: any, res: any) => {
    const interfaces = os.networkInterfaces();
    const addresses: string[] = [];
    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          addresses.push(net.address);
        }
      }
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(JSON.stringify({ 
      ip: addresses[0] || 'localhost', 
      addresses, 
      port: 5173,
      url: `http://${addresses[0] || 'localhost'}:5173`
    }));
  };

  return {
    name: 'network-info-plugin',
    configureServer(server: any) {
      server.middlewares.use('/api/network-info', handler);
    },
    configurePreviewServer(server: any) {
      server.middlewares.use('/api/network-info', handler);
    }
  };
}

export default defineConfig({
  plugins: [
    networkInfoPlugin(),
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
        cacheId: 'ssiro-smart-studio-v1.4.0',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wasm}']
      }
    })
  ],
  server: {
    port: 5173,
    host: true
  },
  preview: {
    port: 5173,
    host: true
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 4096
  }
});

