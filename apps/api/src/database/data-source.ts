import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../config/typeorm.config';

// Wczytaj .env dla CLI migracji (NestJS robi to przez ConfigModule).
dotenv.config();

const dataSource = new DataSource(buildDataSourceOptions());
export default dataSource;
