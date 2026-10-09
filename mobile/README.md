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

## Share Target

- Android/PWA: câmera → Compartilhar → Conora → confirmar lançamento.
- iOS: Share Extension (não intercepta a câmera do SO).
- Atalho interno: Escanear recibo.

## Web vs nativo

- Web/PWA: `base=/app/`
- Android/iOS: `vite build --mode android|ios` com `base=/`
