import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { normalizeLocale } from '@rodno/shared';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type JwtUser } from '../auth/current-user.decorator';
import { AccessService, type AdminUserDto, type PendingUserDto } from './access.service';

class AssignDto {
  @IsUUID()
  individualId: string;
}

/** Panel administracyjny kont — tylko rola admin. */
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly access: AccessService) {}

  /** Wszystkie konta: zaproszone i aktywne, z powiązaną osobą. */
  @Get()
  list(@CurrentUser() me: JwtUser): Promise<AdminUserDto[]> {
    return this.access.listAllUsers(normalizeLocale(me.locale));
  }

  /** Kolejka: konta ze zweryfikowanym mailem, czekające na przypisanie do osoby. */
  @Get('pending')
  pending(): Promise<PendingUserDto[]> {
    return this.access.listPending();
  }

  /** Przypnij/zmień osobę powiązaną z kontem (pierwsza aktywacja → mail powiadamiający). */
  @Patch(':id/individual')
  assign(
    @CurrentUser() me: JwtUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AssignDto,
  ): Promise<AdminUserDto> {
    return this.access.assignIndividual(id, dto.individualId, normalizeLocale(me.locale));
  }

  /** Usuń konto (nie można własnego). */
  @Delete(':id')
  remove(
    @CurrentUser() me: JwtUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.access.deleteUser(id, me.sub);
  }
}
