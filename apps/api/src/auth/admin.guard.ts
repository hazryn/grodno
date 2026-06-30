import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

/** Wymaga roli admin. Używaj PO JwtAuthGuard: @UseGuards(JwtAuthGuard, AdminGuard). */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: { role?: string } }>();
    if (req.user?.role !== 'admin') {
      throw new ForbiddenException('Wymagane uprawnienia administratora.');
    }
    return true;
  }
}
