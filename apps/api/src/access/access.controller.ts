import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AccessService, type ConfirmResult } from './access.service';

class RequestAccessDto {
  @IsString()
  @MaxLength(100)
  firstName: string;

  @IsString()
  @MaxLength(100)
  lastName: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsIn(['pl', 'en', 'de'])
  locale?: string;
}

class ConfirmDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}

class ForgotDto {
  @IsEmail()
  email: string;
}

/** Publiczne endpointy funnela dostępu (bez auth). */
@Controller('access')
export class AccessController {
  constructor(private readonly access: AccessService) {}

  /** Prośba o dostęp — wysyła link weryfikacyjny (zawsze 200, bez ujawniania istnienia konta). */
  @Post('request')
  @HttpCode(200)
  request(@Body() dto: RequestAccessDto): Promise<{ ok: true }> {
    return this.access.request(dto.firstName, dto.lastName, dto.email, dto.locale ?? 'pl');
  }

  /** Potwierdzenie maila + ustawienie hasła. Dopasowani → auto-login; reszta → czeka na admina. */
  @Post('confirm')
  @HttpCode(200)
  confirm(@Body() dto: ConfirmDto): Promise<ConfirmResult> {
    return this.access.confirm(dto.token, dto.password);
  }

  @Post('forgot')
  @HttpCode(200)
  forgot(@Body() dto: ForgotDto): Promise<{ ok: true }> {
    return this.access.forgot(dto.email);
  }

  @Post('reset')
  @HttpCode(200)
  reset(@Body() dto: ConfirmDto): Promise<ConfirmResult> {
    return this.access.reset(dto.token, dto.password);
  }
}
