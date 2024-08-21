import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { compareSync } from 'bcrypt';
import { isEmail, isPhoneNumber } from 'class-validator';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { SignInBodyDto } from './dto/sign-in.req.dto';
import { SignInResDto } from './dto/sign-in.res.dto';
import { SignUpBodyDto } from './dto/sign-up.req.dto';
import { SignUpResDto } from './dto/sign-up.res.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private jwtService: JwtService,
    private userService: UserService,
  ) {}

  generateJwt(user: User): string {
    return this.jwtService.sign({
      sub: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.profilePicPath,
    });
  }

  validateUsername(username: string) {
    let email, phone;

    switch (true) {
      case isEmail(username):
        email = username;
        break;
      case isPhoneNumber(username):
        phone = username;
        break;
      default:
        throw new BadRequestException([
          'username must be a valid email or phone number',
        ]);
    }

    return { email, phone };
  }

  async signUp(body: SignUpBodyDto): Promise<SignUpResDto> {
    await this.userService.create(body);
    return new SignUpResDto({
      data: { message: 'Account Created' },
    });
  }

  async signIn(body: SignInBodyDto): Promise<SignInResDto> {
    const { email, phone } = this.validateUsername(body.username);

    const { data: user } = await this.userService.findOne({
      where: [{ email }, { phone }],
    });

    if (!user.password)
      throw new BadRequestException(
        'you might have sign-up using SSO, please sign-in accordingly',
      );

    if (!compareSync(body.password, user.password))
      throw new ForbiddenException('invalid username or password');

    const token = this.generateJwt(user);

    return new SignInResDto({
      data: { token },
    });
  }

  // async signInWithProvider(
  //   provider: IdentityProviderEnum,
  //   body: SignInProviderBodyDto,
  // ): Promise<SignInResDto> {
  //   switch (provider) {
  //     case IdentityProviderEnum.GOOGLE:
  //       return this.signInWithGoogle(body.token);
  //     default:
  //       throw new BadRequestException('provider not supported');
  //   }
  // }

  async checkUsername(payload: string): Promise<void> {
    const { data: user } = await this.userService.findOne({
      where: { username: payload },
    });
    if (user) throw new ForbiddenException();
  }
}
