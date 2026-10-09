import type { CapacitorConfig } from '@capacitor/cli'

const googleClientId = process.env.VITE_GOOGLE_CLIENT_ID ?? ''
const googleIosClientId = process.env.VITE_GOOGLE_IOS_CLIENT_ID ?? ''

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
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: googleClientId,
      iosClientId: googleIosClientId,
      forceCodeForRefreshToken: false,
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
