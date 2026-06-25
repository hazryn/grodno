import { Logger, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../database/entities';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UsersService } from './users.service';

/**
 * Sekret JWT bez cichego fallbacku: w produkcji brak = błąd (token podpisany znanym
 * dev-sekretem przeszedłby guard). W dev = jawne ostrzeżenie + wartość deweloperska.
 */
function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET jest wymagany w produkcji.');
  }
  new Logger('AuthModule').warn('JWT_SECRET nieustawiony — używam dev-sekretu (TYLKO dev).');
  return 'dev-secret-change-me';
}

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtModule.register({
      secret: resolveJwtSecret(),
      // expiresIn akceptuje napis typu "7d"/"12h" (ms.StringValue) lub liczbę sekund.
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as `${number}d` },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, UsersService, JwtAuthGuard],
  exports: [AuthService, UsersService],
})
export class AuthModule {}
