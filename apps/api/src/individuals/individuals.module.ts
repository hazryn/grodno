import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Event,
  Individual,
  Media,
  ParentChild,
  Partnership,
  Place,
} from '../database/entities';
import { IndividualsController } from './individuals.controller';
import { IndividualsService } from './individuals.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Individual, ParentChild, Partnership, Event, Media, Place]),
  ],
  controllers: [IndividualsController],
  providers: [IndividualsService],
  exports: [IndividualsService],
})
export class IndividualsModule {}
