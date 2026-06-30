import { Global, Module } from '@nestjs/common';
import { MediaService } from './media.service';

/** Presigned URL-e do MinIO. Global, bo zdjęcia podpisuje wiele miejsc. */
@Global()
@Module({
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
