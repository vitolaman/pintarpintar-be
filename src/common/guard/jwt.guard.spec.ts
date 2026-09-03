import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { User } from '~/api/user/entities/user.entity';
import { JwtGuard } from './jwt.guard';

jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn(),
}));

describe('JwtGuard', () => {
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;
  let jwtService: jest.Mocked<Pick<JwtService, 'verifyAsync'>>;
  let userRepository: jest.Mocked<Pick<Repository<User>, 'exists'>>;
  let guard: JwtGuard;

  const contextFor = (authorization?: string) => {
    const request = { headers: { authorization } };

    return {
      getClass: jest.fn(),
      getHandler: jest.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
      request,
    };
  };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    jwtService = { verifyAsync: jest.fn() };
    userRepository = { exists: jest.fn() };
    guard = new JwtGuard(
      { secret: 'test-secret', expiresIn: '30d' },
      jwtService as unknown as JwtService,
      reflector as unknown as Reflector,
      userRepository as unknown as Repository<User>,
    );
  });

  it('allows public routes without examining a token', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    await expect(guard.canActivate(contextFor() as never)).resolves.toBe(true);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('sets the verified active identity on a protected request', async () => {
    const context = contextFor('Bearer valid-token');
    jwtService.verifyAsync.mockResolvedValue({ id: 'user-id' });
    userRepository.exists.mockResolvedValue(true);

    await expect(guard.canActivate(context as never)).resolves.toBe(true);

    expect(context.request).toMatchObject({ user: { id: 'user-id' } });
  });

  it('rejects missing tokens and tokens for deleted users', async () => {
    await expect(
      guard.canActivate(contextFor() as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    jwtService.verifyAsync.mockResolvedValue({ id: 'deleted-user-id' });
    userRepository.exists.mockResolvedValue(false);

    await expect(
      guard.canActivate(contextFor('Bearer expired-user-token') as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token that fails signature verification', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));

    await expect(
      guard.canActivate(contextFor('Bearer invalid-token') as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
