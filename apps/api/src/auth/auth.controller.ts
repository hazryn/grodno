import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import type { Request } from 'express';
import type { User } from '../database/entities';
import { AuthService, type AuthUser, type LoginResult } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UsersService } from './users.service';

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}

class UpdateMeDto {
  @IsIn(['pl', 'en', 'de'])
  locale: string;
}

function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    individualId: user.individualId,
    locale: user.locale,
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Post('login')
  login(@Body() dto: LoginDto): Promise<LoginResult> {
    return this.auth.login(dto.email, dto.password);
  }

  /** Bieżący użytkownik (świeżo z bazy → łapie dezaktywację i aktualne individualId/locale). */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: Request): Promise<AuthUser> {
    return toAuthUser(await this.requireUser(req));
  }

  /** Zmiana preferencji konta (na razie język). */
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(@Req() req: Request, @Body() dto: UpdateMeDto): Promise<AuthUser> {
    const user = await this.requireUser(req);
    user.locale = dto.locale;
    return toAuthUser(await this.users.save(user));
  }

  private async requireUser(req: Request): Promise<User> {
    const payload = (req as Request & { user?: { sub?: string } }).user;
    const user = payload?.sub ? await this.users.findById(payload.sub) : null;
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Konto nieaktywne lub nie istnieje.');
    }
    return user;
  }
}
