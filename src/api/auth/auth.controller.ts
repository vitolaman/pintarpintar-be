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
import { VerifyForgotPasswordOtpDto } from './dto/verify-forgot-password-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { Response } from 'express';
import { CreateNewPasswordDto } from './dto/create-new-password.dto';

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

  @Post('/create-new-password')
  @ApiOperation({
    summary: 'Create New Password',
  })
  @ApiResponse({
    status: 200,
    description: 'Success',
    schema: {
      example: {
        responseMessage: 'Create New Password Success!',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found',
    schema: {
      example: {
        responseMessage: 'User not found',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
    schema: {
      example: {
        responseMessage: 'Token Invalid!',
      },
    },
  })
  async createNewPassword(
    @Body() createNewPasswordDto: CreateNewPasswordDto,
    @Res() res: Response,
  ) {
    const response = await this.authService.createNewPassword(
      createNewPasswordDto,
      res,
    );
    return response;
  }
}
