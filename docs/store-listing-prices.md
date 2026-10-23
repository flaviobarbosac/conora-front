# Preços Conora nas lojas (23/10/2026)

Fonte canônica no código: `Conora.Domain.Catalog.PlanCatalog` e `src/lib/storePrices.ts`.

| Plano (loja) | SKU lógico | Mensal | Anual (10× mensal) | Pessoas |
|---|---|---:|---:|---:|
| Individual | IndividualMonthly / Yearly | R$ 49,90 | R$ 499,00 | 1 |
| Duo | FamilyMonthly / Yearly | R$ 59,90 | R$ 599,00 | 2 |
| Family | FamilyPlusMonthly / Yearly | R$ 79,00 | R$ 790,00 | até 5 |

## Publicação

Os planos são vendidos no app **só pelas lojas** (In-App Purchase no iOS, Google Play Billing no Android):
`src/lib/storeBilling.ts` abre a compra e chama `POST /plan/store/confirm`; a API valida na loja.
SKUs em `src/lib/storeProducts.ts` (iguais a `StoreProductIds` no backend).

Checklist completo das lojas e da API: `Conora-backEnd/docs/store-billing.md`.

Checklist Flavio: [ ] Play (6 assinaturas, plano base `monthly`/`yearly`)  [ ] App Store (1 grupo, 6 produtos enviados com o build)  [ ] API em produção com credenciais das lojas
