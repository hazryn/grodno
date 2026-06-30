import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
} from '@nestjs/common';
import type { GedcomDateValue, MediaDto, MediaTagDto } from '@rodno/shared';
import { IndividualsService } from './individuals.service';

/** Operacje na pojedynczym obiekcie medialnym (opis, data, oznaczenia, usuwanie). */
@Controller('media')
export class MediaController {
  constructor(private readonly service: IndividualsService) {}

  /** Edytuj opis / datę zdjęcia. */
  @Patch(':id')
  patch(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { caption?: string | null; takenDate?: GedcomDateValue | string | null },
  ): Promise<MediaDto> {
    return this.service.patchMedia(id, body);
  }

  /** Zastąp cały zestaw oznaczeń osób na zdjęciu. */
  @Put(':id/tags')
  putTags(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { tags: Array<Partial<MediaTagDto>> },
  ): Promise<MediaDto> {
    return this.service.putMediaTags(id, body.tags ?? []);
  }

  /** Usuń zdjęcie (obiekt MinIO + wiersz + oznaczenia). */
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.service.deleteMedia(id);
  }
}
