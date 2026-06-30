# Rodno — instrukcje projektu

## Migracje TypeORM — PRAWDZIWY timestamp, nie zera

Nazwa pliku migracji i sufiks klasy to **realny epoch w milisekundach** (`Date.now()`),
**nigdy** ręcznie sklejany numer z zerami typu `1782500000000`.

- Bierz znacznik komendą: `date +%s%3N` (np. `1782735759902`).
- Plik: `apps/api/src/database/migrations/<epoch_ms>-Nazwa.ts`, klasa `Nazwa<epoch_ms>`.
- Kolejność migracji ustala ten timestamp — sztuczne zera psują porządek i kolidują.
- Już zaaplikowanych migracji **nie zmieniaj** (są w tabeli `migrations`); reguła dotyczy nowych.

## Architektura danych (kierunek docelowy)

**DB = źródło prawdy.** GEDCOM to tylko **import/eksport**, nie kanon. Relacje modelujemy
jako **bezpośrednie krawędzie osoba↔osoba** (`parent_child` + `partnerships`), nie GEDCOM-owy
`Family/FamilyChild`. ID osób = **UUID v4 losowe**, `xref` (np. `I500001`) to opcjonalny
artefakt importu (nullable), nie tożsamość. Boot importuje GED tylko gdy drzewo puste (seed-once) —
restart nie czyści bazy.

## Porty (lokalnie, 52xx — bez kolizji z innymi projektami)

web `5200`, api `5201`, postgres `5202`, MinIO `5203`/`5204`.

## Dane realne — poza repo

`data/` (GEDCOM, media) jest **gitignored** i NIE trafia do repo ani na zdalne usługi.
Hasło do bazy webtrees nie ląduje w śledzonych plikach.
