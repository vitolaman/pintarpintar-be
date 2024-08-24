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
    status: HttpStatus.OK,
    description: 'Account Created!',
    schema: {
      example: {
        responseMessage: 'Account Created!',
        data: {
          token: 'string',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Email, password, and username cannot be empty!',
    schema: {
      example: {
        responseMessage: 'Email, password, and username cannot be empty!',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'This email already registered!',
    schema: {
      example: {
        responseMessage: 'This email already registered!',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      'Conflict: Either the email or username is already registered.',
    content: {
      'application/json': {
        examples: {
          EmailConflict: {
            summary: 'Email already registered',
            value: {
              responseMessage: 'Email already registered!',
            },
          },
          UsernameConflict: {
            summary: 'Username already registered',
            value: {
              responseMessage: 'Username already registered!',
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Referral Code Not Found!',
    schema: {
      example: {
        responseMessage: 'Referral Code Not Found!',
      },
    },
  })
  async signUp(@Body() body: SignUpBodyDto, @Res() res: Response) {
    return await this.authService.signUp(body, res);
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
        responseMessage: 'Login Success',
        data: {
          token: 'string',
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'FORBIDDEN',
    schema: {
      example: {
        responseMessage: ['invalid username or password'],
        error: 'FORBIDDEN',
        statusCode: 403,
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
