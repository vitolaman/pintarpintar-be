import { ForbiddenException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { UserService } from '../user/user.service';
import { SignInBodyDto } from './dto/sign-in.req.dto';
import { SignInResDto } from './dto/sign-in.res.dto';
import { SignUpBodyDto } from './dto/sign-up.req.dto';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private userService: UserService,
  ) {}

  async signUp(body: SignUpBodyDto): Promise<SignInResDto> {
    const user = await this.userService.create(body);

    return this.createTokenResponse('Account Created!', user.id);
  }

  async signIn(body: SignInBodyDto): Promise<SignInResDto> {
    const user = await this.userService.findForAuthentication(body.email);

    if (!user || !(await compare(body.password, user.passwordHash))) {
      throw new ForbiddenException('invalid username or password');
    }

    return this.createTokenResponse('Login Success', user.id);
  }

  private async createTokenResponse(
    responseMessage: string,
    userId: string,
  ): Promise<SignInResDto> {
    const token = await this.jwtService.signAsync({ id: userId });

    return new SignInResDto({
      responseMessage,
      data: { token },
    });
  }
}
