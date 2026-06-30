import { Controller, Get, Query } from '@nestjs/common';
import { TreesService } from './trees.service';

/**
 * Publiczne (bez auth) agregaty dla strony powitalnej — celowo NIE pod JwtAuthGuard.
 * Zwracamy wyłącznie dane zbiorcze (nazwisko + liczba), nigdy danych pojedynczych osób.
 */
@Controller('public')
export class PublicController {
  constructor(private readonly service: TreesService) {}

  @Get('surnames')
  surnames(
    @Query('tree') tree?: string,
    @Query('limit') limit?: string,
  ): Promise<Array<{ surname: string; count: number }>> {
    const name = tree || process.env.TREE_NAME || 'szejna';
    const n = Math.min(Math.max(Number.parseInt(limit ?? '20', 10) || 20, 1), 50);
    return this.service.topSurnames(name, n);
  }
}
