import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['brand/simbolo.png', 'brand/logo-claro.png', 'brand/logo-escuro.png'],
      manifest: {
        name: 'Conora',
        short_name: 'Conora',
        lang: 'pt-BR',
        description: 'Conora — uma solução Onra',
        theme_color: '#375984',
        background_color: '#F3F3F5',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/brand/simbolo.png', sizes: '192x192', type: 'image/png' },
          { src: '/brand/simbolo.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: Object.fromEntries(
      [
        '/auth',
        '/users',
        '/me',
        '/categories',
        '/diagnosis',
        '/accounts',
        '/credit-cards',
        '/entries',
        '/imports',
        '/budgets',
        '/months',
        '/life-projects',
        '/patrimony',
        '/dashboard',
        '/reports',
        '/export',
        '/members',
        '/plan',
        '/help',
        '/ai',
        '/whatsapp',
        '/audit-events',
      ].map((path) => [
        // Exact segment match (so /mes, /plano, /membros stay SPA routes); page reloads on SPA paths get index.html.
        `^${path}(/|\\?|$)`,
        {
          target: 'http://localhost:5080',
          changeOrigin: true,
          bypass: (req: { headers: { accept?: string } }) =>
            req.headers.accept?.includes('text/html') ? '/index.html' : undefined,
        },
      ]),
    ),
  },
})
