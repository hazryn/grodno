import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { GedcomImportService } from './gedcom-import.service';

/**
 * CLI importu GEDCOM. Bootuje kontekst Nest (bez serwera HTTP), uruchamia migracje
 * (jeśli DB_RUN_MIGRATIONS=true) i importuje plik do wskazanego drzewa.
 *
 *   pnpm --filter @rodno/api import <nazwa-drzewa> <ścieżka.ged> [seed-if-empty|replace]
 *
 * Tryb `seed-if-empty` (boot): importuje tylko gdy drzewo puste — DB jest źródłem prawdy,
 * restart nie nadpisuje edycji. `replace` (domyślny dla CLI): czyści i wczytuje od nowa.
 */
async function main(): Promise<void> {
  const treeName = process.argv[2];
  const filePath = process.argv[3];
  const mode = process.argv[4] === 'seed-if-empty' ? 'seedIfEmpty' : 'replace';
  if (!treeName || !filePath) {
    console.error('Użycie: import <nazwa-drzewa> <ścieżka-do-pliku.ged> [seed-if-empty|replace]');
    process.exit(1);
  }

  const logger = new Logger('ImportCLI');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });
  try {
    const svc = app.get(GedcomImportService);
    const stats = await svc.importFromFile(treeName, filePath, mode);
    logger.log(`✓ Zaimportowano drzewo "${treeName}"`);
    logger.log(JSON.stringify(stats, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
