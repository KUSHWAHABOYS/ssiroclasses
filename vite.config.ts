import { defineConfig, Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

function inAppBrowserProxyPlugin(): Plugin {
  const proxyHandler = async (req: any, res: any, next: any) => {
    if (!req.url || !req.url.startsWith('/api/proxy')) {
      return next();
    }

    try {
      const parsedUrl = new URL(req.url, 'http://localhost:5173');
      let target = parsedUrl.searchParams.get('url');

      if (!target) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.end('Missing URL parameter');
      }

      if (!/^https?:\/\//i.test(target)) {
        if (target.includes('.') && !target.includes(' ')) {
          target = `https://${target}`;
        } else {
          target = `https://www.google.com/search?q=${encodeURIComponent(target)}&igu=1`;
        }
      } else if (target.includes('google.com') && !target.includes('igu=1')) {
        target += (target.includes('?') ? '&' : '?') + 'igu=1';
      }

      const upstream = await fetch(target, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': req.headers['accept'] || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'hi,en-US,en;q=0.9'
        },
        redirect: 'follow'
      });

      const contentType = upstream.headers.get('content-type') || 'text/html';
      res.statusCode = upstream.status;
      res.setHeader('Content-Type', contentType);
      // Strip framing restriction headers completely:
      // NO x-frame-options, NO content-security-policy frame-ancestors!
      res.setHeader('Access-Control-Allow-Origin', '*');

      if (contentType.includes('text/html')) {
        let html = await upstream.text();
        const finalUrl = upstream.url || target;
        const baseTag = `<base href="${finalUrl}">`;

        if (html.includes('<head>')) {
          html = html.replace('<head>', `<head>${baseTag}`);
        } else if (html.includes('<HEAD>')) {
          html = html.replace('<HEAD>', `<HEAD>${baseTag}`);
        } else {
          html = baseTag + html;
        }

        const interceptor = `
          <script>
            (function() {
              document.addEventListener('click', function(e) {
                var a = e.target && e.target.closest ? e.target.closest('a') : null;
                if (a && a.href && a.href.startsWith('http') && !a.href.includes('/api/proxy')) {
                  e.preventDefault();
                  window.location.href = '/api/proxy?url=' + encodeURIComponent(a.href);
                }
              }, true);
            })();
          </script>
        `;
        html = html.replace('</body>', `${interceptor}</body>`);

        res.end(html);
      } else {
        const buf = await upstream.arrayBuffer();
        res.end(Buffer.from(buf));
      }
    } catch (err: any) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(`
        <div style="font-family:sans-serif;padding:30px;color:#f8fafc;background:#0f172a;height:100%;box-sizing:border-box;">
          <h2 style="color:#ef4444;">साइट लोड करने में त्रुटि (Failed to Load)</h2>
          <p>${err?.message || 'Network unreachable'}</p>
        </div>
      `);
    }
  };

  return {
    name: 'in-app-browser-proxy',
    configureServer(server) {
      server.middlewares.use(proxyHandler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(proxyHandler);
    }
  };
}

export default defineConfig({
  plugins: [
    inAppBrowserProxyPlugin(),
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
        // WELCOME-CLEANUP: Bump service worker cache version to v1.4.2
        cacheId: 'ssiro-smart-studio-v1.4.2',
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

