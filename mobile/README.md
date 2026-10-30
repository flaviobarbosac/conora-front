# Conora mobile (Android / iOS)

Capacitor empacota o mesmo front PWA. Bundle: `br.com.conora.app`.

## Preparar

1. Copiar `.env.android.example` → `.env.android` e `.env.ios.example` → `.env.ios`.
2. Android Studio + SDK. iOS: macOS + Xcode + Apple Team em `IOS_DEVELOPMENT_TEAM`.
3. `npm install`

## Android (Play Store)

```
npm run cap:sync
npm run cap:open
npm run android:keystore
npm run android:bundle
```

AAB em `mobile/android/app/build/outputs/bundle/release/`. SHA-1: `npm run android:sha1` (cadastrar no Google Cloud, cliente Android).

## iOS (App Store)

```
npm run cap:sync:ios
npm run cap:open:ios
```

No Xcode: Team, Archive, TestFlight. Incluir o target `ShareExtension` (arquivos em `mobile/ios/ShareExtension`) e o App Group `group.br.com.conora.app`.

Google Sign-In: plugin `@capgo/capacitor-social-login` (SPM no iOS). `Info.plist` precisa do URL scheme `REVERSED_CLIENT_ID` e `GIDClientID`; o script `scripts/sync-ios-google-auth.mjs` escreve isso a partir de `VITE_GOOGLE_IOS_CLIENT_ID`. O workflow **iOS TestFlight** falha se o secret estiver vazio. Em Google Cloud, o cliente iOS deve ter Bundle ID `br.com.conora.app`. Arquivo `mobile/ios/App/App/GoogleService-Info.plist` entra no target App.

## Share Target

- Android/PWA: câmera → Compartilhar → Conora → confirmar lançamento.
- iOS: Share Extension (não intercepta a câmera do SO).
- Atalho interno: Escanear recibo.

## Web vs nativo

- Web/PWA: `base=/app/`
- Android/iOS: `vite build --mode android|ios` com `base=/`
