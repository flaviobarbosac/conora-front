/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_GOOGLE_CLIENT_ID?: string
  readonly VITE_GOOGLE_IOS_CLIENT_ID?: string
  readonly VITE_APPLE_CLIENT_ID?: string
  readonly VITE_PLATAFORMA?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
