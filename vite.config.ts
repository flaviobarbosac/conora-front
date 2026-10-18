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
    resolve: {
      // Compiled .js siblings sit next to the source. Prefer the TypeScript module
      // so a page and its provider share one context.
      extensions: ['.mjs', '.mts', '.ts', '.tsx', '.jsx', '.js', '.json'],
    },
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
              includeAssets: [
                'brand/conora-simbolo.svg',
                'brand/favicon-16.png',
                'brand/favicon-32.png',
                'brand/apple-touch-icon.png',
                'brand/conora-claro.png',
                'brand/conora-escuro.png',
                'brand/logo-claro.png',
                'brand/logo-escuro.png',
              ],
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
                  { src: '/app/brand/pwa-192.png', sizes: '192x192', type: 'image/png' },
                  { src: '/app/brand/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                  { src: '/app/brand/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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
          '/family',
          '/gamification',
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
          '/feedback',
          '/help',
          '/ai',
          '/whatsapp',
          '/receipts',
          '/audit-events',
          '/console',
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
