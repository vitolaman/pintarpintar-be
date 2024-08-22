import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '~/common/decorator/public.decorator';
import { AuthService } from './auth.service';
import { SignInBodyDto } from './dto/sign-in.req.dto';
import { SignUpBodyDto } from './dto/sign-up.req.dto';
import { VerifyForgotPasswordOtpDto } from '../user/dto/verify-forgot-password-otp.dto';
import { ForgotPasswordDto } from '../user/dto/forgot-password.dto';
import { Response } from 'express';

@Controller('auth')
@ApiTags('Auth')
@Public()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sign-up')
  @ApiOperation({
    summary: 'User sign up',
  })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: 200,
    description: 'Success',
    schema: {
      example: {
        message: 'Account Created',
      },
    },
  })
  signUp(@Body() body: SignUpBodyDto) {
    return this.authService.signUp(body);
  }

  @Post('sign-in')
  @ApiOperation({
    summary: 'Sign in with email and password',
  })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: 200,
    description: 'Success',
    schema: {
      example: {
        data: {
          token: 'string',
        },
      },
    },
  })
  signIn(@Body() body: SignInBodyDto) {
    return this.authService.signIn(body);
  }

  @Post('/forgot-password')
  @ApiOperation({
    summary: 'Forgot Password',
  })
  @ApiResponse({
    status: 200,
    description: 'Success',
    schema: {
      example: {
        responseMessage: 'OTP Sent Successfully!',
        data: {
          token: '1234',
        },
      },
    },
  })
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
    @Res() res: Response,
  ) {
    const response = await this.authService.forgotPassword(
      forgotPasswordDto.email,
      res,
    );

    return response;
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
        responseMessage: 'Successful OTP Verification!',
        data: {
          token: 'hiogado5731031259hfoaidsfd',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    schema: {
      example: {
        responseMessage: 'Wrong OTP / Not Found!',
      },
    },
  })
  async verifyForgotPasswordOtp(
    @Body() verifyForgotPasswordOtpDto: VerifyForgotPasswordOtpDto,
    @Res() res: Response,
  ) {
    const response = await this.authService.verifyForgotPasswordOtp(
      verifyForgotPasswordOtpDto,
      res,
    );
    return response;
  }
}
