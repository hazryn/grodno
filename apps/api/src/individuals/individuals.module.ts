import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Event,
  EventParticipant,
  Individual,
  Media,
  MediaTag,
  ParentChild,
  Partnership,
  Place,
} from '../database/entities';
import { IndividualsController } from './individuals.controller';
import { MediaController } from './media.controller';
import { EventsController } from './events.controller';
import { IndividualsService } from './individuals.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Individual,
      ParentChild,
      Partnership,
      Event,
      EventParticipant,
      Media,
      MediaTag,
      Place,
    ]),
  ],
  controllers: [IndividualsController, MediaController, EventsController],
  providers: [IndividualsService],
  exports: [IndividualsService],
})
export class IndividualsModule {}
