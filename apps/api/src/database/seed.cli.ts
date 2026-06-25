import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';

/**
 * Seed = uruchomienie kontekstu Nest, co odpala UsersService.onModuleInit
 * (idempotentne utworzenie admina). Migracje też się odpalą, jeśli DB_RUN_MIGRATIONS=true.
 */
async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });
  new Logger('SeedCLI').log('Seed zakończony');
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
