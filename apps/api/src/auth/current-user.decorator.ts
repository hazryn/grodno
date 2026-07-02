import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** Payload JWT wpięty przez JwtAuthGuard w request.user. */
export interface JwtUser {
  sub: string;
  email: string;
  role: string;
  individualId: string | null;
  locale: string;
}

/** Skrót na `req.user` (payload JWT) — mniej boilerplate'u w kontrolerach czatu. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: JwtUser }>();
    return req.user as JwtUser;
  },
);
