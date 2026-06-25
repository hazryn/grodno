import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import { ALL_ENTITIES } from '../database/entities';

/**
 * Wspólne opcje połączenia — używane i przez NestJS (runtime), i przez TypeORM CLI
 * (migracje). Encje przekazujemy jawną tablicą (działa pod ts-node i po kompilacji),
 * migracje globem .{ts,js} (CLI ładuje .ts, runtime .js).
 */
export function buildDataSourceOptions(): DataSourceOptions {
  return {
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number.parseInt(process.env.DB_PORT ?? '5202', 10),
    username: process.env.DB_USER ?? 'rodno',
    password: process.env.DB_PASSWORD ?? 'rodno',
    database: process.env.DB_NAME ?? 'rodno',
    entities: ALL_ENTITIES,
    migrations: [join(__dirname, '../database/migrations/*.{ts,js}')],
    synchronize: false,
    logging: process.env.DB_LOGGING === 'true',
  };
}
