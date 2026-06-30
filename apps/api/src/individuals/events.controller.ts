import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import type { EventDto } from '@rodno/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IndividualsService, type EventInput } from './individuals.service';

/** Edycja / usuwanie pojedynczego zdarzenia osi czasu (tworzenie: POST /individuals/:id/events). */
@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly service: IndividualsService) {}

  @Patch(':id')
  patch(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: EventInput,
  ): Promise<EventDto> {
    return this.service.patchEvent(id, body);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.service.deleteEvent(id);
  }
}
