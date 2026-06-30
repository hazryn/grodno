import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Individual } from '../database/entities';
import { AuthModule } from '../auth/auth.module';
import { AccessController } from './access.controller';
import { AdminUsersController } from './admin-users.controller';
import { AccessService } from './access.service';

@Module({
  imports: [TypeOrmModule.forFeature([Individual]), AuthModule],
  controllers: [AccessController, AdminUsersController],
  providers: [AccessService],
})
export class AccessModule {}
