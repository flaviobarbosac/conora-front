import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'package.json'), 'utf8'))

export default defineConfig(({ mode }) => {
  const isNative = mode === 'android' || mode === 'ios' || mode.startsWith('android')
  const base = isNative ? '/' : '/app/'

  return {
    base,
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [
      react(),
      ...(isNative
        ? []
        : [
            VitePWA({
              strategies: 'injectManifest',
              srcDir: 'src/pwa',
              filename: 'sw.ts',
              registerType: 'autoUpdate',
              includeAssets: ['brand/simbolo.png', 'brand/logo-claro.png', 'brand/logo-escuro.png'],
              injectManifest: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
                maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
              },
              manifest: {
                name: 'Conora',
                short_name: 'Conora',
                lang: 'pt-BR',
                description: 'Conora — uma solução Onra',
                theme_color: '#375984',
                background_color: '#F3F3F5',
                display: 'standalone',
                start_url: '/app/',
                scope: '/app/',
                icons: [
                  { src: '/app/brand/simbolo.png', sizes: '192x192', type: 'image/png' },
                  { src: '/app/brand/simbolo.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                ],
                share_target: {
                  action: '/app/compartilhar',
                  method: 'POST',
                  enctype: 'multipart/form-data',
                  params: {
                    title: 'title',
                    text: 'text',
                    url: 'url',
                    files: [{ name: 'media', accept: ['image/*'] }],
                  },
                },
              },
            }),
          ]),
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
  }
})
