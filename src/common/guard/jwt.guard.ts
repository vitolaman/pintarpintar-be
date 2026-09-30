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
import jwtConfig from '~/config/jwt.config';
import { IS_PUBLIC_ENDPOINT } from '../decorator/public.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '~/api/user/entities/user.entity';
import { Repository } from 'typeorm';

interface JwtPayload {
  id: string;
  // Token version at issue time; tokens from before revocation existed have
  // none and count as version 0.
  tv?: number;
}

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    @Inject(jwtConfig.KEY)
    private jwtCfg: ConfigType<typeof jwtConfig>,
    private jwtService: JwtService,
    private reflector: Reflector,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublicEndpoint = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_ENDPOINT,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    // Public routes stay open; a valid token only identifies the caller
    // (for example to mark the merchant owner on the storefront).
    if (isPublicEndpoint) {
      const payload = token ? await this.verify(token) : null;
      if (payload) request['user'] = payload;
      return true;
    }

    if (!token) throw new UnauthorizedException();

    const payload = await this.verify(token);
    if (!payload) throw new UnauthorizedException();

    request['user'] = payload;
    return true;
  }

  private async verify(token: string): Promise<JwtPayload | null> {
    try {
      const { secret } = this.jwtCfg;
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret,
      });
      if (!payload?.id) return null;

      const user = await this.userRepo.findOne({ where: { id: payload.id } });
      if (!user || (payload.tv ?? 0) !== user.tokenVersion) return null;
      return payload;
    } catch {
      return null;
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];

    return type === 'Bearer' ? token : undefined;
  }
}
