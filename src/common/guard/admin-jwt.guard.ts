import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { IS_PUBLIC_ENDPOINT } from '../decorator/public.decorator';
import adminJwtConfig from '~/config/admin-jwt.config';

import { SetMetadata } from '@nestjs/common';

export const ADMIN_JWT_GUARD_KEY = 'adminJwtGuard';

export const UseAdminJwtGuard = () => SetMetadata(ADMIN_JWT_GUARD_KEY, true);

@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(
    @Inject(adminJwtConfig.KEY)
    private adminJwtCfg: ConfigType<typeof adminJwtConfig>,
    private jwtService: JwtService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublicEndpoint = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_ENDPOINT,
      [context.getHandler(), context.getClass()],
    );

    if (isPublicEndpoint) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) throw new UnauthorizedException();

    try {
      const { secret } = this.adminJwtCfg;
      const payload = await this.jwtService.verifyAsync(token, { secret });
      request['admin'] = payload;
    } catch {
      throw new UnauthorizedException();
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];

    return type === 'Bearer' ? token : undefined;
  }
}
