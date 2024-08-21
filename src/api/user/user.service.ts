import { HttpStatus, Injectable } from '@nestjs/common';
import { RedisService } from '~/common/redis/src';
import { redisConstant } from '~/constant/redis.constant';
import * as moment from 'moment-timezone';
import { VerifyForgotPasswordOtpDto } from './dto/verify-forgot-password-otp.dto';
import { Response } from 'express';

@Injectable()
export class UserService {
  constructor(private readonly redisService: RedisService) {}

  async forgotPassword(email: string, res: Response) {
    // Todo: send OTP to client email

    const redisKey = redisConstant.ACCESS_TOKEN_FORGOT_PASSWORD + email;

    const otp = this._generateOtp();
    const tokenData = {
      otp: otp,
      createdAt: moment.utc().format('YYYY-MM-DDTHH:mm:ssZ'),
      expiredAt: moment.utc().add(5, 'minutes').format('YYYY-MM-DDTHH:mm:ssZ'),
    };

    await this.redisService.saveCache(redisKey, tokenData, 300);

    return res.status(HttpStatus.OK).json({
      responseMessage: `OTP Berhasil Dikirimkan!`,
      otp: otp,
    });
  }

  private _generateOtp() {
    const otp = Math.floor(Math.random() * 10000);
    return otp.toString().padStart(4, '0');
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

      return res.status(HttpStatus.OK).json({
        responseMessage: `Berhasil Verifikasi OTP!`,
      });
    }

    return res.status(HttpStatus.UNAUTHORIZED).json({
      responseMessage: `OTP Salah / Tidak Ditemukan!`,
    });
  }
}
