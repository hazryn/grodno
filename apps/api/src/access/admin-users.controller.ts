import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccessService, type PendingUserDto } from './access.service';

class AssignDto {
  @IsUUID()
  individualId: string;
}

/** Panel administracyjny kont — tylko rola admin. */
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly access: AccessService) {}

  /** Kolejka: konta ze zweryfikowanym mailem, czekające na przypisanie do osoby. */
  @Get('pending')
  pending(): Promise<PendingUserDto[]> {
    return this.access.listPending();
  }

  /** Przypnij konto do osoby w drzewie → aktywacja + mail powiadamiający. */
  @Patch(':id/individual')
  assign(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AssignDto,
  ): Promise<PendingUserDto> {
    return this.access.assignIndividual(id, dto.individualId);
  }
}
