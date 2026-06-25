# Rodno

> Nowoczesna, open-source aplikacja genealogiczna. Cel długoterminowy: pełny parytet
> funkcjonalny z webtrees, ale z UX i DevX z 2026. **To repo zawiera POC Fazy 0.**

Nazwa kodowa **Rodno** (od słow. *Rod* — bóstwo rodu, przodków i losu).
Pełna specyfikacja: Outline → kolekcja projektu → „Rodno — Specyfikacja".

## Co już działa (POC Faza 0)

Pionowy plaster przez cały stack, na **realnych danych**:

```
webtrees (nexus) ──GEDCOM──▶ import ──▶ Postgres ──▶ bundle API ──▶ interaktywne drzewo (Nuxt)
```

- **Import GEDCOM** — własny parser + mapper. Zaimportowane drzewo „szejna":
  **1050 osób, 298 rodzin, 2176 zdarzeń, 685 znormalizowanych miejsc, 112 źródeł, 414 mediów.**
- **Model danych** zgodny z GEDCOM, ale zaprojektowany od zera (encje gazetteer dla miejsc,
  typ wartości daty GEDCOM, węzeł rodziny zamiast krawędzi osoba-osoba, soft-delete).
- **API `bundle`** — osoba + jeden skok relacji (rodzice/małżonek/dzieci/rodzeństwo) z flagami
  `hasParents`/`childCount`; głęboki `payload` (N pokoleń w jednym requeście); detal + wyszukiwarka.
- **Viewer** — interaktywne drzewo klepsydra (przodkowie w górę, potomkowie w dół), leniwe
  rozwijanie +/−, pan/zoom, modal osoby z osią czasu zdarzeń, wyszukiwarka.
- **Auth** — JWT Bearer + seed admina (endpointy read w POC są publiczne — patrz niżej).

## Stack

| Warstwa | Technologia |
|---|---|
| Monorepo | pnpm workspaces + turbo |
| `apps/api` | NestJS + TypeORM + PostgreSQL |
| `apps/web` | Nuxt 3 + Tailwind + silnik drzewa (SVG; layout odseparowany od renderera) |
| `packages/shared` | wspólne typy domenowe i kontrakty API (front ↔ back) |

## Porty (lokalnie, 52+ — bez kolizji z innymi projektami)

| Usługa | Port |
|---|---|
| web (Nuxt) | **5200** |
| API (NestJS) | **5201** |
| Postgres | **5202** |
| MinIO (S3 API) | **5203** |
| MinIO (konsola) | **5204** |

## Najszybciej — cały stack jednym poleceniem

```bash
docker compose up --build
# web:    http://localhost:5200
# API:    http://localhost:5201/api
```

Wstaje Postgres + API + web + **MinIO** (zdjęcia). API uruchamia migracje i — jeśli `./data/szejna.ged`
istnieje — **auto-importuje drzewo** (idempotentnie); `minio-init` wgrywa `./data/media/*` do bucketu
`rodno-media` (publiczny odczyt). Sam Postgres do pracy z `pnpm dev`: `docker compose up -d postgres`.

## Tryb dev (hot reload)

```bash
pnpm install
docker compose up -d postgres            # Postgres na :5202
cp apps/api/.env.example apps/api/.env
pnpm --filter @rodno/shared build && pnpm --filter @rodno/api build
pnpm --filter @rodno/api import szejna ./data/szejna.ged   # migracje + seed + import
pnpm --filter @rodno/api dev             # API  :5201
pnpm --filter @rodno/web dev             # web  :5200 (osobny terminal)
```

> **Dane:** plik `./data/szejna.ged` i cały katalog `data/` są w `.gitignore` — to realne dane
> osób żyjących, nie trafiają do repo. Eksport pochodzi z webtrees na nexusie.

## Struktura

```
apps/
  api/   NestJS — encje, migracje, importer GEDCOM, bundle API, auth
  web/   Nuxt — viewer drzewa, modal osoby, wyszukiwarka
packages/
  shared/  typy: GedcomDateValue, PersonCard/Bundle/BundlePayload, DTO domeny
data/      pliki GEDCOM (gitignored)
docker-compose.yml  lokalny Postgres
```

## Świadome skróty POC (do rozwinięcia)

- Endpointy **read są publiczne** (viewer działa bez logowania); `isLiving` jest liczone, ale
  jeszcze nie egzekwowane — filtrowanie prywatności żyjących to kolejny krok.
- Renderer drzewa: **SVG** (spec docelowo: WebGL/PixiJS). Silnik layoutu już jest odseparowany.
- Zdjęcia: pliki w MinIO (oryginały, bucket publiczny). Generowane miniatury (sharp) i prywatny
  dostęp przez podpisane URL-e — kolejny krok.
- Round-trip GEDCOM, Typesense (search), mapa (MapLibre) — kolejne fazy.
- Multi-marriage: bundle pokazuje pierwszą rodzinę małżeńską (jak sprawdzony moduł webtrees).

## Licencja

MIT.
