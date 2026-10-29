import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/lib/**/*.ts', 'src/theme/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        // Native / DOM / Capacitor adapters — covered by device/E2E, not Vitest node.
        'src/lib/voiceDraft.ts',
        'src/lib/voiceEntry.ts',
        'src/lib/voiceInterview.ts',
        'src/lib/voiceVisualizer.ts',
        'src/lib/nativeSpeech.ts',
        'src/lib/qrInvite.ts',
        'src/lib/receiptFlow.ts',
        'src/lib/resetMobileViewport.ts',
        'src/lib/storeBilling.ts',
        'src/lib/confirm.ts',
        'src/lib/saveToast.ts',
        'src/lib/planCheckout.ts',
        'src/lib/journeyTrack.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 70,
      },
    },
  },
})
