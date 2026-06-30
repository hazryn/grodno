import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type {
  Bundle,
  BundlePayload,
  EventDto,
  IndividualDto,
  Locale,
  MediaDto,
  PersonCard,
} from '@rodno/shared';
import { normalizeLocale } from '@rodno/shared';
import {
  IndividualsService,
  type EventInput,
  type UpdateIndividualInput,
  type UploadedFile as ServiceFile,
} from './individuals.service';

/** Minimalny kształt pliku z Multera (bez @types/multer). */
interface MulterFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

function toInt(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Język widza z tokenu JWT (do lokalizacji displayName/lifespan/spouseName na kartach). */
function viewerLocale(req: Request): Locale {
  return normalizeLocale((req as Request & { user?: { locale?: string } }).user?.locale);
}

@UseGuards(JwtAuthGuard)
@Controller('individuals')
export class IndividualsController {
  constructor(private readonly service: IndividualsService) {}

  /** Lista / wyszukiwarka osób w drzewie. */
  @Get()
  list(
    @Req() req: Request,
    @Query('treeId', new ParseUUIDPipe()) treeId: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ): Promise<PersonCard[]> {
    return this.service.list(treeId, search, toInt(limit, 50), viewerLocale(req));
  }

  @Get(':id')
  getOne(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<IndividualDto> {
    return this.service.getIndividual(id, viewerLocale(req));
  }

  /** Bundle: osoba + jeden skok relacji (do leniwego rozwijania drzewa). */
  @Get(':id/bundle')
  getBundle(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<Bundle> {
    return this.service.getBundle(id, viewerLocale(req));
  }

  /** Głęboki payload startowy: focal + `up` pokoleń w górę i `down` w dół. */
  @Get(':id/payload')
  getPayload(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('up') up?: string,
    @Query('down') down?: string,
  ): Promise<BundlePayload> {
    const upN = Math.min(Math.max(toInt(up, 4), 0), 8);
    const downN = Math.min(Math.max(toInt(down, 2), 0), 6);
    return this.service.getPayload(id, upN, downN, viewerLocale(req));
  }

  /* ----------------------------------- zapis ----------------------------------- */

  /** Edycja danych podstawowych (imię/nazwisko, płeć, bio, sociale, e-maile). */
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateIndividualInput,
  ): Promise<IndividualDto> {
    return this.service.updateIndividual(id, body);
  }

  /** Ustaw avatar (już docięty po stronie klienta). */
  @Post(':id/avatar')
  @UseInterceptors(FileInterceptor('file'))
  uploadAvatar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: MulterFile,
  ): Promise<IndividualDto> {
    return this.service.uploadAvatar(id, file as ServiceFile);
  }

  /** Galeria osoby (bez avatara), posortowana. */
  @Get(':id/gallery')
  gallery(@Param('id', new ParseUUIDPipe()) id: string): Promise<MediaDto[]> {
    return this.service.listGallery(id);
  }

  /** Wgraj jedno lub wiele zdjęć do galerii. */
  @Post(':id/media')
  @UseInterceptors(FilesInterceptor('files', 30))
  uploadMedia(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFiles() files: MulterFile[],
  ): Promise<MediaDto[]> {
    return this.service.uploadMedia(id, (files ?? []) as ServiceFile[]);
  }

  /** Zmień kolejność zdjęć w galerii. */
  @Patch(':id/media/order')
  reorder(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { ids: string[] },
  ): Promise<void> {
    return this.service.reorderMedia(id, body.ids ?? []);
  }

  /** Dodaj zdarzenie na osi czasu (z opcjonalnymi uczestnikami, np. chrzestnymi). */
  @Post(':id/events')
  addEvent(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: EventInput,
  ): Promise<EventDto> {
    return this.service.addEvent(id, body);
  }

  /* ----------------------------------- małżeństwa ----------------------------------- */

  /** Dodaj małżeństwo/związek (małżonek z drzewa). */
  @Post(':id/marriages')
  addMarriage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { spouseId: string; type?: string },
  ): Promise<IndividualDto> {
    return this.service.addMarriage(id, body);
  }

  /** Edytuj małżeństwo: data, miejsce, typ, zmiana małżonka. */
  @Patch(':id/marriages/:pid')
  patchMarriage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('pid', new ParseUUIDPipe()) pid: string,
    @Body() body: Parameters<IndividualsService['patchMarriage']>[2],
  ): Promise<IndividualDto> {
    return this.service.patchMarriage(id, pid, body);
  }

  /** Usuń małżeństwo (partnerstwo + zdarzenia + zdjęcie ślubu). */
  @Delete(':id/marriages/:pid')
  deleteMarriage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('pid', new ParseUUIDPipe()) pid: string,
  ): Promise<IndividualDto> {
    return this.service.deleteMarriage(id, pid);
  }

  /** Wgraj/zmień zdjęcie ślubu. */
  @Post(':id/marriages/:pid/photo')
  @UseInterceptors(FileInterceptor('file'))
  marriagePhoto(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('pid', new ParseUUIDPipe()) pid: string,
    @UploadedFile() file: MulterFile,
  ): Promise<IndividualDto> {
    return this.service.uploadMarriagePhoto(id, pid, file as ServiceFile);
  }
}
