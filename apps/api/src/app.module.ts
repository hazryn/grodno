import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildDataSourceOptions } from './config/typeorm.config';
import { ImportModule } from './import/import.module';
import { IndividualsModule } from './individuals/individuals.module';
import { TreesModule } from './trees/trees.module';
import { AuthModule } from './auth/auth.module';
import { AccessModule } from './access/access.module';
import { MailModule } from './mail/mail.module';
import { MediaModule } from './media/media.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        ...buildDataSourceOptions(),
        // Dev: migracje na starcie. Prod: false + jawny `pnpm migration:run`.
        migrationsRun: process.env.DB_RUN_MIGRATIONS === 'true',
      }),
    }),
    MailModule,
    MediaModule,
    ImportModule,
    IndividualsModule,
    TreesModule,
    AuthModule,
    AccessModule,
  ],
})
export class AppModule {}
