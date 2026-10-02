import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource, EntityManager } from 'typeorm';
import { Profile } from '../profile/entities/profile.entity';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';
import { SignInBodyDto } from './dto/sign-in.req.dto';
import { SignUpBodyDto } from './dto/sign-up.req.dto';

jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn(),
}));

describe('AuthService', () => {
  let userService: jest.Mocked<
    Pick<
      UserService,
      'createWithManager' | 'findForAuthentication' | 'findCurrentUser'
    >
  >;
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync'>>;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;
  let entityManager: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
  };
  let service: AuthService;

  const user = {
    id: '06f7152e-7cc9-42f6-a4f0-8a84eb31e384',
    name: 'John Doe',
    email: 'john@example.com',
    passwordHash: '',
    tokenVersion: 0,
  } as User;

  const currentUser = {
    id: user.id,
    name: 'John Doe',
    email: 'john@example.com',
    is_mentor: false,
    is_merchant: false,
    mentor_id: null,
    merchant_id: null,
    created_at: new Date('2026-10-01T00:00:00.000Z'),
    updated_at: new Date('2026-10-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    userService = {
      createWithManager: jest.fn(),
      findForAuthentication: jest.fn(),
      findCurrentUser: jest.fn().mockResolvedValue(currentUser),
    };
    jwtService = {
      signAsync: jest.fn(),
    };
    entityManager = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn(),
    };
    (dataSource.transaction as jest.Mock).mockImplementation(
      async (runInTransaction: (manager: EntityManager) => Promise<unknown>) =>
        runInTransaction(entityManager as unknown as EntityManager),
    );
    service = new AuthService(
      jwtService as unknown as JwtService,
      userService as unknown as UserService,
      dataSource as unknown as DataSource,
    );
  });

  it('registers and returns the token with the current user', async () => {
    userService.createWithManager.mockResolvedValue(user);
    entityManager.create.mockReturnValue({ userId: user.id });
    jwtService.signAsync.mockResolvedValue('signed-token');

    await expect(
      service.signUp({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password1',
      }),
    ).resolves.toEqual({
      responseMessage: 'Account Created!',
      data: { token: 'signed-token', user: currentUser },
    });
    expect(userService.findCurrentUser).toHaveBeenCalledWith(user.id);

    expect(jwtService.signAsync).toHaveBeenCalledWith({ id: user.id, tv: 0 });
    expect(userService.createWithManager).toHaveBeenCalledWith(entityManager, {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'password1',
    });
    expect(entityManager.create).toHaveBeenCalledWith(Profile, {
      userId: user.id,
    });
    expect(entityManager.save).toHaveBeenCalledWith(Profile, {
      userId: user.id,
    });
  });

  it('signs in active users and returns the token with the current user', async () => {
    user.passwordHash = await hash('password1', 10);
    userService.findForAuthentication.mockResolvedValue(user);
    jwtService.signAsync.mockResolvedValue('signed-token');

    await expect(
      service.signIn({ email: 'john@example.com', password: 'password1' }),
    ).resolves.toEqual({
      responseMessage: 'Login Success',
      data: { token: 'signed-token', user: currentUser },
    });
    expect(userService.findCurrentUser).toHaveBeenCalledWith(user.id);
  });

  it('returns a generic credential error for an unknown email', async () => {
    userService.findForAuthentication.mockResolvedValue(null);

    await expect(
      service.signIn({ email: 'john@example.com', password: 'password1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      service.signIn({ email: 'john@example.com', password: 'password1' }),
    ).rejects.toThrow('invalid username or password');
    expect(userService.findCurrentUser).not.toHaveBeenCalled();
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

  it('signs in with the user current token version', async () => {
    user.passwordHash = await hash('password1', 10);
    userService.findForAuthentication.mockResolvedValue({
      ...user,
      tokenVersion: 3,
    } as User);
    jwtService.signAsync.mockResolvedValue('signed-token');

    await service.signIn({ email: 'john@example.com', password: 'password1' });

    expect(jwtService.signAsync).toHaveBeenCalledWith({ id: user.id, tv: 3 });
  });

  it('ends other sessions by raising the version and returning a new token', async () => {
    entityManager.findOne.mockResolvedValue({ ...user, tokenVersion: 1 });
    jwtService.signAsync.mockResolvedValue('fresh-token');

    await expect(service.endOtherSessions(user.id)).resolves.toEqual({
      responseMessage: 'Other sessions ended',
      data: { token: 'fresh-token' },
    });
    expect(entityManager.save).toHaveBeenCalledWith(
      User,
      expect.objectContaining({ tokenVersion: 2 }),
    );
    expect(jwtService.signAsync).toHaveBeenCalledWith({ id: user.id, tv: 2 });
  });

  describe('changePassword', () => {
    beforeEach(async () => {
      entityManager.findOne.mockResolvedValue({
        ...user,
        passwordHash: await hash('password1', 10),
        tokenVersion: 0,
      });
      jwtService.signAsync.mockResolvedValue('fresh-token');
    });

    it('stores the new password, ends other sessions and returns a token', async () => {
      await expect(
        service.changePassword(user.id, {
          current_password: 'password1',
          new_password: 'password2',
        }),
      ).resolves.toEqual({
        responseMessage: 'Password changed',
        data: { token: 'fresh-token' },
      });
      const [, saved] = entityManager.save.mock.calls[0];
      expect(saved.tokenVersion).toBe(1);
      await expect(compare('password2', saved.passwordHash)).resolves.toBe(
        true,
      );
      expect(jwtService.signAsync).toHaveBeenCalledWith({ id: user.id, tv: 1 });
    });

    it.each([
      [
        'a wrong current password',
        { current_password: 'wrong1', new_password: 'password2' },
      ],
      [
        'an unchanged password',
        { current_password: 'password1', new_password: 'password1' },
      ],
    ])('rejects %s with 400', async (_label, input) => {
      await expect(
        service.changePassword(user.id, input),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(entityManager.save).not.toHaveBeenCalled();
    });
  });
});

describe('auth request DTOs', () => {
  const signUp = {
    name: 'John Doe',
    email: 'john.doe@gmail.com',
    password: 'qwerty12',
  };

  async function errorFields(target: new () => object, value: object) {
    const errors = await validate(plainToInstance(target, value));
    return errors.map((error) => error.property);
  }

  it('trims the name and email but never the password', async () => {
    const dto = plainToInstance(SignUpBodyDto, {
      name: '  John Doe ',
      email: ' john.doe@gmail.com ',
      password: ' qwerty12 ',
    });
    expect(dto).toMatchObject({
      name: 'John Doe',
      email: 'john.doe@gmail.com',
      password: ' qwerty12 ',
    });
    expect(await validate(dto)).toEqual([]);
  });

  it.each([[''], ['   '], [null]])(
    'rejects a sign-up name or email of %j',
    async (text) => {
      expect(
        await errorFields(SignUpBodyDto, {
          ...signUp,
          name: text,
          email: text,
        }),
      ).toEqual(['name', 'email']);
    },
  );

  it.each([[''], [null]])('rejects a password of %j', async (password) => {
    const errors = await validate(
      plainToInstance(SignUpBodyDto, { ...signUp, password }),
    );
    expect(errors.map((error) => error.property)).toEqual(['password']);
    expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    expect(
      await errorFields(SignInBodyDto, {
        email: signUp.email,
        password,
      }),
    ).toEqual(['password']);
  });

  it('rejects a blank sign-in email', async () => {
    expect(
      await errorFields(SignInBodyDto, { email: '  ', password: 'x' }),
    ).toEqual(['email']);
  });
});
