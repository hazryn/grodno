import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Individual, Tree } from '../database/entities';
import { AuthModule } from '../auth/auth.module';
import { TreesController } from './trees.controller';
import { PublicController } from './public.controller';
import { TreesService } from './trees.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tree, Individual]), AuthModule],
  controllers: [TreesController, PublicController],
  providers: [TreesService],
})
export class TreesModule {}
