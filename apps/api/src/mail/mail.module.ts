import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

/** Globalny, żeby AccessModule (i kolejne) miały MailService bez powtarzania importu. */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
