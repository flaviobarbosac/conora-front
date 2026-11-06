import { defineConfig, devices } from '@playwright/test'

const update = process.env.GUARD_RAIL_UPDATE_BASELINES === '1'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'guard-rail.spec.ts',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'e2e/guard-rail-playwright.json' }],
  ],
  snapshotPathTemplate: 'e2e/guard-rail/baselines/{projectName}/{arg}{ext}',
  updateSnapshots: update ? 'all' : 'none',
  expect: {
    timeout: 20_000,
    toHaveScreenshot: {
      maxDiffPixels: 0,
      animations: 'disabled',
      caret: 'hide',
    },
  },
  use: {
    baseURL: 'http://localhost:5175/app/',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5175/app/',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'web', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'mobile-portrait', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } },
    { name: 'mobile-landscape', use: { ...devices['Pixel 5'], viewport: { width: 844, height: 390 } } },
  ],
})
