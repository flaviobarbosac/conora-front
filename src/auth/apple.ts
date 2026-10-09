import { SignInWithApple } from '@capacitor-community/apple-sign-in'
import { isIosApp } from '../lib/platform'

export function appleSignInAvailable(): boolean {
  return isIosApp() && Boolean(import.meta.env.VITE_APPLE_CLIENT_ID)
}

export async function requestAppleIdentityToken(): Promise<string> {
  if (!appleSignInAvailable()) {
    throw new Error('Entrar com Apple ainda não está configurado neste ambiente.')
  }
  const result = await SignInWithApple.authorize({
    clientId: import.meta.env.VITE_APPLE_CLIENT_ID as string,
    redirectURI: 'https://conora.com.br/app/login',
    scopes: 'email name',
  })
  const token = result.response.identityToken
  if (!token) {
    throw new Error('Token Apple ausente.')
  }
  return token
}
