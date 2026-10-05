import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '~/common/decorator/public.decorator';
import { Throttle } from '@nestjs/throttler';
import {
  DefaultResponse,
  MessageResponse,
} from '~/common/decorator/response.decorator';
import { ClientAddressThrottlerGuard } from '~/common/guard/client-address-throttler.guard';
import { AuthService } from './auth.service';
import { AuthTokenWithUserDto } from './dto/auth-token-with-user.dto';
import { SignInBodyDto } from './dto/sign-in.req.dto';
import { SignUpBodyDto } from './dto/sign-up.req.dto';
import {
  ConfirmPasswordResetDto,
  RequestPasswordResetDto,
} from './dto/password-reset.dto';
import {
  PASSWORD_RESET,
  PasswordResetService,
  RESET_LINK_INVALID,
  RESET_REQUESTED,
} from './password-reset.service';

@Controller('api/v1/auth')
@ApiTags('Auth')
@Public()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  @Post('sign-up')
  @ApiOperation({
    summary: 'User sign up',
  })
  @HttpCode(HttpStatus.OK)
  @DefaultResponse(AuthTokenWithUserDto, 'Account Created!', HttpStatus.OK, [
    BadRequestException,
    new ConflictException('Email already registered'),
  ])
  signUp(@Body() body: SignUpBodyDto) {
    return this.authService.signUp(body);
  }

  @Post('sign-in')
  @ApiOperation({
    summary: 'Sign in with email and password',
  })
  @HttpCode(HttpStatus.OK)
  @DefaultResponse(AuthTokenWithUserDto, 'Login Success', HttpStatus.OK, [
    BadRequestException,
    new ForbiddenException('invalid username or password'),
  ])
  signIn(@Body() body: SignInBodyDto) {
    return this.authService.signIn(body);
  }

  // The same answer for every address, so the route reveals no accounts.
  @Post('password-reset')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ClientAddressThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @ApiOperation({
    summary: 'Email a password reset link',
    description:
      'Always 200 with the same body. An active account gets an email with a single-use link to `/reset-password?token=…`, valid for 60 minutes; at most one email a minute and five an hour per account. 5 requests per 10 minutes per client address.',
  })
  @MessageResponse(RESET_REQUESTED, [BadRequestException])
  requestPasswordReset(@Body() body: RequestPasswordResetDto) {
    return this.passwordReset.request(body);
  }

  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ClientAddressThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  @ApiOperation({
    summary: 'Set a new password with a reset link token',
    description:
      'Signs the account out of every device and makes all its reset links unusable. 400 with one message for an unknown, malformed, expired or used token; 400 naming `new_password` for a weak password. 10 requests per 10 minutes per client address.',
  })
  @MessageResponse(PASSWORD_RESET, [
    new BadRequestException(RESET_LINK_INVALID),
  ])
  confirmPasswordReset(@Body() body: ConfirmPasswordResetDto) {
    return this.passwordReset.confirm(body);
  }
}
