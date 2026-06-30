#!/bin/sh
set -e

# Migracje odpalą się przy starcie (DB_RUN_MIGRATIONS=true). Opcjonalny auto-import
# drzewa, jeśli zamontowano plik GEDCOM (idempotentny — czyści i wczytuje na nowo).
if [ "$AUTO_IMPORT" = "true" ] && [ -f "$GEDCOM_PATH" ]; then
  echo "[entrypoint] Seed drzewa '$TREE_NAME' z $GEDCOM_PATH (seed-if-empty — DB jest źródłem prawdy) ..."
  node dist/import/import.cli.js "$TREE_NAME" "$GEDCOM_PATH" seed-if-empty || echo "[entrypoint] seed nieudany — startuję mimo to"
else
  echo "[entrypoint] Auto-import pominięty (AUTO_IMPORT=$AUTO_IMPORT, plik: $GEDCOM_PATH)"
fi

exec node dist/main.js
