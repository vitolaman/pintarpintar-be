import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { compareSync, hashSync } from 'bcryptjs';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { SignInBodyDto } from './dto/sign-in.req.dto';
import { SignInResDto } from './dto/sign-in.res.dto';
import { SignUpBodyDto } from './dto/sign-up.req.dto';
import { RedisService } from '~/common/redis/src';
import { redisConstant } from '~/constant/redis.constant';
import * as moment from 'moment';
import { Response } from 'express';
import { VerifyForgotPasswordOtpDto } from './dto/verify-forgot-password-otp.dto';
import { CreateNewPasswordDto } from './dto/create-new-password.dto';
import { ConfigService } from '@nestjs/config';
import { SendMailClient } from 'zeptomail';
import { VerifyOtpRegisterUserDto } from './dto/verify-otp-register-user.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private jwtService: JwtService,
    private userService: UserService,
    private readonly redisService: RedisService,
    private configService: ConfigService,
  ) {}

  async generateJwt(user: User, deviceToken: string): Promise<string> {
    const userData = await this.userRepo.findOne({ where: { id: user.id } });
    userData.deviceToken = deviceToken;
    await this.userRepo.save(userData);

    return this.jwtService.sign({
      id: user.id,
      deviceToken: deviceToken,
    });
  }

  async signUp(body: SignUpBodyDto, res: Response) {
    return await this.userService.create(body, res);
  }

  async signIn(body: SignInBodyDto): Promise<SignInResDto> {
    const { email, deviceToken } = body;
    const { data: user } = await this.userService.findOne({
      where: { email },
    });

    if (!user.password)
      throw new BadRequestException(
        'you might have sign-up using SSO, please sign-in accordingly',
      );

    if (!compareSync(body.password, user.password))
      throw new ForbiddenException('invalid username or password');

    if (user.isEmailVerified == false)
      throw new UnprocessableEntityException(
        'Please verified email to continue',
      );

    const token = await this.generateJwt(user, deviceToken);

    return new SignInResDto({
      responseMessage: 'Login Success',
      data: { token, isEmailVerif: user.isEmailVerified },
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

  async forgotPassword(email: string, res: Response) {
    const redisKey = redisConstant.ACCESS_TOKEN_FORGOT_PASSWORD + email;

    const otp = this._generateOtp();
    const tokenData = {
      otp: otp,
      createdAt: moment.utc().format('YYYY-MM-DDTHH:mm:ssZ'),
      expiredAt: moment.utc().add(5, 'minutes').format('YYYY-MM-DDTHH:mm:ssZ'),
    };

    await this.redisService.saveCache(redisKey, tokenData, 300);

    this._sendOtpMail(otp, email);

    return res.status(HttpStatus.OK).json({
      responseMessage: `OTP Sent Successfully!`,
      data: {
        otp,
      },
    });
  }

  private _generateOtp() {
    const otp = Math.floor(Math.random() * 10000);
    return otp.toString().padStart(4, '0');
  }

  private _sendOtpMail(otp: string, email: string) {
    const mailApiKey = this.configService.get<string>('ZEPTO_API_KEY');
    const mailApiUrl = this.configService.get<string>('ZEPTO_API_URL');
    console.log(mailApiKey, mailApiUrl);
    const client = new SendMailClient({ url: mailApiUrl, token: mailApiKey });

    client
      .sendMail({
        from: {
          address: 'noreply@prdict.app',
          name: 'noreply',
        },
        to: [
          {
            email_address: {
              address: email,
              name: 'Predict App',
            },
          },
        ],
        subject: 'Forgot Password OTP Email',
        htmlbody: `<div>This is your forgot password otp: <b> ${otp} </b></div>`,
      })
      .then((resp) => console.log('success', resp))
      .catch((error) => console.log('error', error));
  }

  generateEmailTokenJwt(email: string): string {
    return this.jwtService.sign({ email });
  }

  async verifyForgotPasswordOtp(
    verifyForgotPasswordOtpDto: VerifyForgotPasswordOtpDto,
    res: Response,
  ) {
    const redisKey =
      redisConstant.ACCESS_TOKEN_FORGOT_PASSWORD +
      verifyForgotPasswordOtpDto.email;

    const redisData = await this.redisService.getCache(redisKey);

    if (redisData && redisData['otp'] === verifyForgotPasswordOtpDto.otp) {
      await this.redisService.removeCache(redisKey);

      const tokenJwt = this.generateEmailTokenJwt(
        verifyForgotPasswordOtpDto.email,
      );

      const redisEmailKey =
        redisConstant.ACCESS_TOKEN_CREATE_NEW_PASSWORD +
        verifyForgotPasswordOtpDto.email;

      await this.redisService.saveCache(redisEmailKey, tokenJwt, 600);

      return res.status(HttpStatus.OK).json({
        responseMessage: `Successful OTP Verification!`,
        data: {
          token: tokenJwt,
        },
      });
    }

    return res.status(HttpStatus.UNAUTHORIZED).json({
      responseMessage: `Wrong OTP / Not Found!`,
    });
  }

  async createNewPassword(
    createNewPasswordDto: CreateNewPasswordDto,
    res: Response,
  ) {
    const { email, token, password, deviceToken } = createNewPasswordDto;

    const redisKey = redisConstant.ACCESS_TOKEN_CREATE_NEW_PASSWORD + email;

    const redisData = await this.redisService.getCache(redisKey);

    if (redisData && redisData === token) {
      await this.redisService.removeCache(redisKey);

      const user = await this.userRepo.findOneBy({ email });

      if (!user) {
        return res.status(HttpStatus.NOT_FOUND).json({
          responseMessage: `User not found`,
        });
      }

      const hashPassword = hashSync(password, 10);

      user.password = hashPassword;

      await this.userRepo.save(user);

      const tokenLoginUser = this.generateJwt(user, deviceToken);

      return res.status(HttpStatus.OK).json({
        responseMessage: `Create New Password Success!`,
        data: {
          token: tokenLoginUser,
        },
      });
    }

    return res.status(HttpStatus.UNAUTHORIZED).json({
      responseMessage: `Token Invalid!`,
    });
  }

  async sendOtpRegisterUser(email: string, res: Response) {
    const redisKey = redisConstant.ACCESS_TOKEN_REGISTER_USER + email;

    const otp = this._generateOtp();
    const tokenData = {
      otp: otp,
      createdAt: moment.utc().format('YYYY-MM-DDTHH:mm:ssZ'),
      expiredAt: moment.utc().add(5, 'minutes').format('YYYY-MM-DDTHH:mm:ssZ'),
    };

    await this.redisService.saveCache(redisKey, tokenData, 300);

    this._sendOtpMail(otp, email);

    return res.status(HttpStatus.OK).json({
      responseMessage: `OTP Sent Successfully!`,
      data: {
        otp,
      },
    });
  }

  async verifyOtpRegisterUser(body: VerifyOtpRegisterUserDto, res: Response) {
    const redisKey = redisConstant.ACCESS_TOKEN_REGISTER_USER + body.email;

    const redisData = await this.redisService.getCache(redisKey);

    if (redisData && redisData['otp'] === body.otp) {
      await this.redisService.removeCache(redisKey);

      const user = await this.userRepo.findOneBy({ email: body.email });

      if (!user) {
        return res.status(HttpStatus.NOT_FOUND).json({
          responseMessage: `User not found`,
        });
      }

      const tokenLoginUser = this.generateJwt(user, body.deviceToken);

      user.isEmailVerified = true;

      await this.userRepo.save(user);

      return res.status(HttpStatus.OK).json({
        responseMessage: `Successful OTP Verification! Your Account has Been Verified`,
        data: {
          token: tokenLoginUser,
        },
      });
    }

    return res.status(HttpStatus.UNAUTHORIZED).json({
      responseMessage: `Wrong OTP / Not Found!`,
    });
  }
}
