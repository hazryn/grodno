import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Individual, Tree } from '../database/entities';
import { TreesController } from './trees.controller';
import { TreesService } from './trees.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tree, Individual])],
  controllers: [TreesController],
  providers: [TreesService],
})
export class TreesModule {}
