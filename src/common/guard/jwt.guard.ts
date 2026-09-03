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

    if (isPublicEndpoint) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) throw new UnauthorizedException();

    try {
      const { secret } = this.jwtCfg;
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret,
      });

      if (
        !payload?.id ||
        !(await this.userRepo.exists({ where: { id: payload.id } }))
      ) {
        throw new UnauthorizedException();
      }

      request['user'] = payload;
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
