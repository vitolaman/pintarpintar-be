import { Controller, Post, Body, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { UserService } from './user.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { VerifyForgotPasswordOtpDto } from './dto/verify-forgot-password-otp.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('/forgot-password')
  @ApiOperation({
    summary: 'Forgot Password',
  })
  @ApiResponse({
    status: 200,
    description: 'Success',
    schema: {
      example: {
        response: 'OTP Berhasil Dikirimkan!',
      },
    },
  })
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
    @Res() res: Response,
  ) {
    const response = await this.userService.forgotPassword(
      forgotPasswordDto.email,
    );

    return res.status(HttpStatus.OK).json(response);
  }

  @Post('/verify-forgot-password-otp')
  @ApiOperation({
    summary: 'Verify Forgot Password OTP',
  })
  @ApiResponse({
    status: 200,
    description: 'Success',
    schema: {
      example: {
        response: 'Berhasil Verifikasi OTP!',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request',
    schema: {
      example: {
        response: 'OTP Salah / Tidak Ditemukan!',
      },
    },
  })
  async verifyForgotPasswordOtp(
    @Body() verifyForgotPasswordOtpDto: VerifyForgotPasswordOtpDto,
    @Res() res: Response,
  ) {
    const response = await this.userService.verifyForgotPasswordOtp(
      verifyForgotPasswordOtpDto,
    );
    return res.status(HttpStatus.OK).json(response);
  }
}
