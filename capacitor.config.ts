import type { CapacitorConfig } from '@capacitor/cli'

export const iosDevelopmentTeam = process.env.IOS_DEVELOPMENT_TEAM ?? ''

const config: CapacitorConfig = {
  appId: 'br.com.conora.app',
  appName: 'Conora',
  webDir: 'dist',
  android: {
    path: 'mobile/android',
  },
  ios: {
    path: 'mobile/ios',
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    // Google client IDs are passed at runtime via SocialLogin.initialize (src/auth/google.ts).
    SocialLogin: {
      providers: {
        google: true,
        apple: false,
        facebook: false,
        twitter: false,
        linkedin: false,
        telegram: false,
        tiktok: false,
      },
    },
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#375984',
    },
    SystemBars: {
      insetsHandling: 'css',
      style: 'DARK',
    },
    CapacitorHttp: {
      enabled: true,
    },
  },
}

export default config
