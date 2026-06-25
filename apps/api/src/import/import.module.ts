import { Module } from '@nestjs/common';
import { GedcomImportService } from './gedcom-import.service';

@Module({
  providers: [GedcomImportService],
  exports: [GedcomImportService],
})
export class ImportModule {}
