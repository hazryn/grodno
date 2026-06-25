import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import type {
  Bundle,
  BundlePayload,
  IndividualDto,
  PersonCard,
} from '@rodno/shared';
import { IndividualsService } from './individuals.service';

function toInt(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

@Controller('individuals')
export class IndividualsController {
  constructor(private readonly service: IndividualsService) {}

  /** Lista / wyszukiwarka osób w drzewie. */
  @Get()
  list(
    @Query('treeId', new ParseUUIDPipe()) treeId: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ): Promise<PersonCard[]> {
    return this.service.list(treeId, search, toInt(limit, 50));
  }

  @Get(':id')
  getOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<IndividualDto> {
    return this.service.getIndividual(id);
  }

  /** Bundle: osoba + jeden skok relacji (do leniwego rozwijania drzewa). */
  @Get(':id/bundle')
  getBundle(@Param('id', new ParseUUIDPipe()) id: string): Promise<Bundle> {
    return this.service.getBundle(id);
  }

  /** Głęboki payload startowy: focal + `up` pokoleń w górę i `down` w dół. */
  @Get(':id/payload')
  getPayload(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('up') up?: string,
    @Query('down') down?: string,
  ): Promise<BundlePayload> {
    const upN = Math.min(Math.max(toInt(up, 4), 0), 8);
    const downN = Math.min(Math.max(toInt(down, 2), 0), 6);
    return this.service.getPayload(id, upN, downN);
  }
}
