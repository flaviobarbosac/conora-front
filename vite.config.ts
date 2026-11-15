import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'package.json'), 'utf8'))

const publicSiteRoot = join(dirname(fileURLToPath(import.meta.url)), '../Conora-backEnd/infra/public-site')

/** Dev only: the marketing home lives at `/`, the app at `/app/`, same as production. */
function conoraPublicSite() {
  const pages: Record<string, string> = {
    '/': 'index.html',
    '/privacidade': 'privacidade.html',
    '/termos': 'termos.html',
    '/site.css': 'site.css',
  }
  return {
    name: 'conora-public-site',
    configureServer(server: { middlewares: { use: Function } }) {
      server.middlewares.use((req: { method?: string; url?: string }, res: { setHeader: Function; end: Function }, next: () => void) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          next()
          return
        }
        const path = (req.url ?? '').split('?')[0]
        const fileName = pages[path]
        let full = fileName ? join(publicSiteRoot, fileName) : ''
        if (!full && path.startsWith('/img/')) {
          const rel = path.slice('/img/'.length)
          if (!rel || rel.includes('..') || rel.includes('\\') || rel.includes('/')) {
            next()
            return
          }
          full = join(publicSiteRoot, 'img', rel)
        }
        if (!full || !existsSync(full)) {
          next()
          return
        }
        const ext = extname(full).toLowerCase()
        const type =
          ext === '.css' ? 'text/css; charset=utf-8'
          : ext === '.webp' ? 'image/webp'
          : ext === '.png' ? 'image/png'
          : ext === '.svg' ? 'image/svg+xml'
          : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
          : 'text/html; charset=utf-8'
        res.setHeader('Content-Type', type)
        res.end(req.method === 'HEAD' ? undefined : readFileSync(full))
      })
    },
  }
}

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
      conoraPublicSite(),
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
                    files: [
                      {
                        name: 'media',
                        accept: [
                          'image/*',
                          'application/pdf',
                          '.pdf',
                          '.ofx',
                          '.qfx',
                          '.csv',
                          'text/csv',
                          'application/x-ofx',
                        ],
                      },
                    ],
                  },
                },
              },
            }),
          ]),
    ],
    server: {
      port: 5175,
      strictPort: true,
      proxy: Object.fromEntries(
        [
          '/auth',
          '/users',
          '/me',
          '/categories',
          '/family',
          '/gamification',
          '/journey',
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
