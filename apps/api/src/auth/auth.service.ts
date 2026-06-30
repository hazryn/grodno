import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from './users.service';
import type { User } from '../database/entities';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  individualId: string | null;
  locale: string;
}

export interface LoginResult {
  accessToken: string;
  user: AuthUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.users.findByEmail(email.trim().toLowerCase());
    if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Błędny e-mail lub hasło');
    }
    if (!user.isActive) {
      throw new ForbiddenException('Konto oczekuje na zatwierdzenie przez administratora.');
    }
    return this.issue(user);
  }

  /** Podpis JWT + payload użytkownika. Token dostają wyłącznie aktywne konta. */
  issue(user: User): LoginResult {
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      individualId: user.individualId,
      locale: user.locale,
    };
    const accessToken = this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      individualId: user.individualId,
      locale: user.locale,
    });
    return { accessToken, user: authUser };
  }
}
