import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { User } from '~/api/user/entities/user.entity';
import { Public } from '../decorator/public.decorator';
import { IsAdmin } from '../decorator/is-admin.decorator';
import { AdminGuard } from './admin.guard';
import { JwtGuard } from './jwt.guard';

class Routes {
  @IsAdmin()
  restricted() {}
  @Public()
  @IsAdmin()
  publicRestricted() {}
  normal() {}
}

const context = (method: keyof Routes, id?: string) =>
  ({
    getHandler: () => Routes.prototype[method],
    getClass: () => Routes,
    switchToHttp: () => ({
      getRequest: () => ({ user: id ? { id } : undefined }),
    }),
  }) as never;

describe('AdminGuard', () => {
  let config: { get: jest.Mock };
  let guard: AdminGuard;
  beforeEach(() => {
    config = { get: jest.fn().mockReturnValue(' user-1 , USER-2 ') };
    guard = new AdminGuard(new Reflector(), config as unknown as ConfigService);
  });

  it('does not restrict ordinary routes', () => {
    expect(guard.canActivate(context('normal'))).toBe(true);
  });
  it('requires an authenticated user even if a route is also public', () => {
    expect(() => guard.canActivate(context('restricted'))).toThrow(
      UnauthorizedException,
    );
  });
  it('allows configured IDs, matching the full ID only', () => {
    expect(guard.canActivate(context('restricted', 'user-1'))).toBe(true);
    expect(guard.canActivate(context('restricted', 'user-2'))).toBe(true);
    expect(() => guard.canActivate(context('restricted', 'user'))).toThrow(
      ForbiddenException,
    );
  });
  it('denies everyone if the allowlist is unset', () => {
    config.get.mockReturnValue(undefined);
    expect(() => guard.canActivate(context('restricted', 'user-1'))).toThrow(
      ForbiddenException,
    );
  });

  it('denies invalid or revoked credentials even when public and admin metadata are combined', async () => {
    const reflector = new Reflector();
    const jwt = { verifyAsync: jest.fn() };
    const users = { findOne: jest.fn() };
    const jwtGuard = new JwtGuard(
      { secret: 'test-secret', expiresIn: '30d' },
      jwt as unknown as JwtService,
      reflector,
      users as unknown as Repository<User>,
    );
    const request: {
      headers: { authorization: string };
      user?: { id: string };
    } = {
      headers: { authorization: 'Bearer revoked-token' },
    };
    const combinedContext = {
      getHandler: () => Routes.prototype.publicRestricted,
      getClass: () => Routes,
      switchToHttp: () => ({ getRequest: () => request }),
    } as never;
    jwt.verifyAsync.mockResolvedValue({ id: 'user-1', tv: 0 });
    users.findOne.mockResolvedValue({ id: 'user-1', tokenVersion: 1 });
    expect(await jwtGuard.canActivate(combinedContext)).toBe(true);
    expect(() => guard.canActivate(combinedContext)).toThrow(
      UnauthorizedException,
    );
  });
});
