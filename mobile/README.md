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

## Meta SDK (iOS)

Plugin local `mobile/plugins/conora-meta-sdk` (SPM, `FacebookCore` 19.x). Inicia o SDK da Meta ao abrir o app para medir instalações de campanhas de app iOS 14+ (AEM/SKAdNetwork). Sem IDFA e sem prompt de rastreamento (ATT); metadados de tela e amostragem de layout desligados no `Info.plist`.

- `FacebookAppID` = 1091193193739341 (app Meta "Conora").
- `FacebookClientToken` = `$(FACEBOOK_CLIENT_TOKEN)`, resolvido no build. No CI vem do secret `META_CLIENT_TOKEN` (Meta Developers → app Conora → Configurações → Avançado → Token do cliente). O workflow **iOS TestFlight** falha se o secret estiver vazio.
- Build local sem o token roda normalmente, só sem medição da Meta.

## Meta SDK (Android)

`com.facebook.android:facebook-core` 19.x em `app/build.gradle`; meta-data no `AndroidManifest.xml`. Mesmo App ID e mesmo secret `META_CLIENT_TOKEN` (lido pelo Gradle via env ou `-PmetaClientToken=`); o workflow **Android Google Play** falha se ele estiver vazio. Sem token o SDK não inicia (`AutoInitEnabled=false`). Atribuição pelo Install Referrer do Google Play: as permissões de ID de publicidade (`AD_ID`, `ACCESS_ADSERVICES_AD_ID`, `_TOPICS`, `_CUSTOM_AUDIENCE`) são removidas no manifest; metadados de tela e amostragem de layout desligados.

## Meta App Events (funil)

Wrapper `src/lib/metaEvents.ts` (`registerPlugin('ConoraMetaSdk')`, no-op na web) chama `logEvent(name, params?, valueToSum?)`: iOS no plugin local (`AppEvents.shared.logEvent`), Android em `ConoraMetaSdkPlugin.java` (`AppEventsLogger`, registrado no `MainActivity`). Sem token da Meta o SDK fica desligado e o método só devolve `logged: false`.

Nomes estáveis (usados no mapeamento de valores de conversão do SKAdNetwork no Events Manager):

| Evento | Quando | Params |
|---|---|---|
| `fb_mobile_complete_registration` | Conta criada: validação do e-mail do pré-cadastro (`/validar-email`) ou retorno direto do `register` (dev). Uma vez por conta no aparelho. | `fb_registration_method` (`email`/`google`/`apple`, quando conhecido) |
| `subscription_confirmed` | Compra na loja validada pela API (`phase = Subscribed`). | `plan`, `tier`, `cycle`, `fb_currency=BRL`; `valueToSum` = preço do catálogo |
| `milestone_achieved` | Marco da jornada conquistado (visto em `/gamification/achievements` ou `/gamification/home`, conquistado há no máximo 7 dias e ainda não registrado no aparelho). | `milestone_id` (chave do marco) |

Compras: `fb_mobile_purchase` / `Subscribe` / `StartTrial` **não** são logados à mão. O SDK registra sozinho as assinaturas da loja (StoreKit 2 no iOS; Play Billing 8+ no Android — `facebook-core` 19.0.1 tem o wrapper V8+, e o `@capgo/native-purchases` usa Billing 9.1), com "Registrar compras no app automaticamente" ligado no Events Manager. Logar de novo contaria em dobro; `subscription_confirmed` é só o reforço custom confirmado pelo servidor.

Sem dados pessoais nos params (App Privacy declara só Interação com o produto e Histórico de compras): nada de e-mail, nome, CPF ou userId — o userId só serve de chave local de deduplicação no `localStorage`.

## Share Target

- Android/PWA: câmera → Compartilhar → Conora → confirmar lançamento.
- iOS: Share Extension (não intercepta a câmera do SO).
- Atalho interno: Escanear recibo.

## Web vs nativo

- Web/PWA: `base=/app/`
- Android/iOS: `vite build --mode android|ios` com `base=/`
