import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';

/**
 * Query parameters a route declares are validated by its query DTO, which
 * rejects unknown ones. A route without a query DTO would otherwise ignore
 * any query string, so an unknown parameter there is rejected the same way.
 */
@Injectable()
export class UndeclaredQueryGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest();
    const keys = Object.keys(request.query ?? {});
    if (keys.length === 0) return true;

    const routeArgs: Record<string, { index: number }> =
      Reflect.getMetadata(
        ROUTE_ARGS_METADATA,
        context.getClass(),
        context.getHandler().name,
      ) ?? {};
    const readsQuery = Object.keys(routeArgs).some(
      (key) => Number(key.split(':')[0]) === RouteParamtypes.QUERY,
    );
    if (readsQuery) return true;

    const messages = keys.map((key) => `property ${key} should not exist`);
    throw new BadRequestException(messages);
  }
}
