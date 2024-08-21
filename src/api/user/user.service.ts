import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { RedisService } from '~/common/redis/src';
import { redisConstant } from '~/constant/redis.constant';
import * as moment from 'moment-timezone';
import { VerifyForgotPasswordOtpDto } from './dto/verify-forgot-password-otp.dto';

@Injectable()
export class UserService {
  constructor(private readonly redisService: RedisService) {}

  async forgotPassword(email: string) {
    // Todo: send OTP to client email

    const redisKey = redisConstant.ACCESS_TOKEN_FORGOT_PASSWORD + email;

    try {
      const otp = this._generateOtp();
      const tokenData = {
        otp: otp,
        createdAt: moment.utc().format('YYYY-MM-DDTHH:mm:ssZ'),
        expiredAt: moment
          .utc()
          .add(5, 'minutes')
          .format('YYYY-MM-DDTHH:mm:ssZ'),
      };

      await this.redisService.saveCache(redisKey, tokenData, 300);

      return {
        response: 'OTP Berhasil Dikirimkan!',
        otp: otp,
      };
    } catch (error) {
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  private _generateOtp() {
    const otp = Math.floor(Math.random() * 10000);
    return otp.toString().padStart(4, '0');
  }

  async verifyForgotPasswordOtp(
    verifyForgotPasswordOtpDto: VerifyForgotPasswordOtpDto,
  ) {
    const redisKey =
      redisConstant.ACCESS_TOKEN_FORGOT_PASSWORD +
      verifyForgotPasswordOtpDto.email;

    try {
      const redisData = await this.redisService.getCache(redisKey);

      if (redisData && redisData['otp'] === verifyForgotPasswordOtpDto.otp) {
        return {
          response: 'Berhasil Verifikasi OTP!',
        };
      }

      return new BadRequestException('OTP Salah / Tidak Ditemukan!');
    } catch (error) {
      throw new InternalServerErrorException('Internal Server Error');
    }
  }
}
