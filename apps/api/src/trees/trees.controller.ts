import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TreesService, type TreeSummary } from './trees.service';

@UseGuards(JwtAuthGuard)
@Controller('trees')
export class TreesController {
  constructor(private readonly service: TreesService) {}

  @Get()
  list(): Promise<TreeSummary[]> {
    return this.service.list();
  }

  @Get(':name')
  getByName(@Param('name') name: string): Promise<TreeSummary> {
    return this.service.getByName(name);
  }
}
