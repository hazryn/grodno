import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { GedcomImportService } from './gedcom-import.service';

/**
 * CLI importu GEDCOM. Bootuje kontekst Nest (bez serwera HTTP), uruchamia migracje
 * (jeśli DB_RUN_MIGRATIONS=true) i importuje plik do wskazanego drzewa.
 *
 *   pnpm --filter @rodno/api import <nazwa-drzewa> <ścieżka.ged>
 */
async function main(): Promise<void> {
  const treeName = process.argv[2];
  const filePath = process.argv[3];
  if (!treeName || !filePath) {
    console.error('Użycie: import <nazwa-drzewa> <ścieżka-do-pliku.ged>');
    process.exit(1);
  }

  const logger = new Logger('ImportCLI');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });
  try {
    const svc = app.get(GedcomImportService);
    const stats = await svc.importFromFile(treeName, filePath);
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
