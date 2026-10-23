# Preços Conora nas lojas (23/10/2026)

Fonte canônica no código: `Conora.Domain.Catalog.PlanCatalog` e `src/lib/storePrices.ts`.

| Plano (loja) | SKU lógico | Mensal | Anual (10× mensal) | Pessoas |
|---|---|---:|---:|---:|
| Individual | IndividualMonthly / Yearly | R$ 49,90 | R$ 499,00 | 1 |
| Duo | FamilyMonthly / Yearly | R$ 59,90 | R$ 599,00 | 2 |
| Family | FamilyPlusMonthly / Yearly | R$ 79,00 | R$ 790,00 | até 5 |

## Publicação

1. Google Play Console → assinaturas: cadastrar/atualizar os três produtos com estes valores.
2. App Store Connect → assinaturas: mesmos valores (sem preço de aluno; aluno = 90 dias de trial no app).
3. Conferir que o app lê ofertas via API (`/plan`) — não hardcode de preço na UI nativa de checkout (Android/iOS ocultam checkout digital).

Checklist Flavio: [ ] Play atualizado  [ ] App Store atualizado  [ ] API em produção com PlanCatalog novo
