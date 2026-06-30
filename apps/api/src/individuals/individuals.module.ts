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
import { AuthModule } from '../auth/auth.module';
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
    AuthModule,
  ],
  controllers: [IndividualsController, MediaController, EventsController],
  providers: [IndividualsService],
  exports: [IndividualsService],
})
export class IndividualsModule {}
