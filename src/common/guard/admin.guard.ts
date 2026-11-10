import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { IS_ADMIN_ENDPOINT } from '../decorator/is-admin.decorator';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(
      IS_ADMIN_ENDPOINT,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const userId = context.switchToHttp().getRequest()?.user?.id;
    if (typeof userId !== 'string' || !userId)
      throw new UnauthorizedException();
    const admins = (this.config.get<string>('ADMIN_USER_IDS') ?? '')
      .split(',')
      .map((id) => id.trim().toLowerCase())
      .filter(Boolean);
    if (!admins.includes(userId.toLowerCase())) throw new ForbiddenException();
    return true;
  }
}
