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
import { isAdminUser } from './admin-users';

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
    if (!isAdminUser(this.config, userId)) throw new ForbiddenException();
    return true;
  }
}
