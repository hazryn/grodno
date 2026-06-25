import { Controller, Get, Param } from '@nestjs/common';
import { TreesService, type TreeSummary } from './trees.service';

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
