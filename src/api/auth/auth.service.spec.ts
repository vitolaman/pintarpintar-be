import { ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash } from 'bcryptjs';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';

jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn(),
}));

describe('AuthService', () => {
  let userService: jest.Mocked<
    Pick<UserService, 'create' | 'findForAuthentication'>
  >;
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync'>>;
  let service: AuthService;

  const user = {
    id: '06f7152e-7cc9-42f6-a4f0-8a84eb31e384',
    name: 'John Doe',
    email: 'john@example.com',
    passwordHash: '',
  } as User;

  beforeEach(() => {
    userService = {
      create: jest.fn(),
      findForAuthentication: jest.fn(),
    };
    jwtService = {
      signAsync: jest.fn(),
    };
    service = new AuthService(
      jwtService as unknown as JwtService,
      userService as unknown as UserService,
    );
  });

  it('registers and returns the approved token response envelope', async () => {
    userService.create.mockResolvedValue(user);
    jwtService.signAsync.mockResolvedValue('signed-token');

    await expect(
      service.signUp({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password1',
      }),
    ).resolves.toEqual({
      responseMessage: 'Account Created!',
      data: { token: 'signed-token' },
    });

    expect(jwtService.signAsync).toHaveBeenCalledWith({ id: user.id });
  });

  it('signs in active users with matching credentials', async () => {
    user.passwordHash = await hash('password1', 10);
    userService.findForAuthentication.mockResolvedValue(user);
    jwtService.signAsync.mockResolvedValue('signed-token');

    await expect(
      service.signIn({ email: 'john@example.com', password: 'password1' }),
    ).resolves.toEqual({
      responseMessage: 'Login Success',
      data: { token: 'signed-token' },
    });
  });

  it('returns a generic credential error for an unknown email', async () => {
    userService.findForAuthentication.mockResolvedValue(null);

    await expect(
      service.signIn({ email: 'john@example.com', password: 'password1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      service.signIn({ email: 'john@example.com', password: 'password1' }),
    ).rejects.toThrow('invalid username or password');
  });

  it('returns the same generic credential error for an incorrect password', async () => {
    userService.findForAuthentication.mockResolvedValue({
      ...user,
      passwordHash: await hash('different1', 10),
    });

    await expect(
      service.signIn({ email: 'john@example.com', password: 'password1' }),
    ).rejects.toThrow('invalid username or password');
  });
});
