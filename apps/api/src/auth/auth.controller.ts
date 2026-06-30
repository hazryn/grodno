import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import type { Request } from 'express';
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

  /** Bieżący użytkownik (świeżo z bazy → łapie dezaktywację i aktualne individualId). */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: Request): Promise<AuthUser> {
    const payload = (req as Request & { user?: { sub?: string } }).user;
    const user = payload?.sub ? await this.users.findById(payload.sub) : null;
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Konto nieaktywne lub nie istnieje.');
    }
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      individualId: user.individualId,
    };
  }
}
