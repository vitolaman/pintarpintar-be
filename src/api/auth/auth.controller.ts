import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '~/common/decorator/public.decorator';
import { Throttle } from '@nestjs/throttler';
import {
  DefaultResponse,
  MessageResponse,
} from '~/common/decorator/response.decorator';
import {
  ClientAddressThrottlerGuard,
  SignInAccountThrottlerGuard,
} from '~/common/guard/client-address-throttler.guard';
import { AuthService, INVALID_CREDENTIALS } from './auth.service';
import { AuthTokenWithUserDto } from './dto/auth-token-with-user.dto';
import { GoogleLinkBodyDto } from './dto/google-link.req.dto';
import { GoogleSignInBodyDto } from './dto/google-sign-in.req.dto';
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
import {
  GOOGLE_SIGN_IN_FAILED,
  GOOGLE_SIGN_IN_UNAVAILABLE,
} from './google-id-token.verifier';
import {
  EMAIL_LINKED_TO_OTHER_GOOGLE_ACCOUNT,
  GOOGLE_ACCOUNT_LINKED_ELSEWHERE_MESSAGE,
  GOOGLE_ALREADY_LINKED_MESSAGE,
  GoogleSignInService,
  NO_ACCOUNT_TO_LINK,
  PASSWORD_ACCOUNT_EXISTS_MESSAGE,
} from './google-sign-in.service';

@Controller('api/v1/auth')
@ApiTags('Auth')
@Public()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordReset: PasswordResetService,
    private readonly googleSignIn: GoogleSignInService,
  ) {}

  @Post('sign-up')
  @UseGuards(ClientAddressThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 600_000 } })
  @ApiOperation({
    summary: 'User sign up',
    description: '20 requests per 10 minutes per client address.',
  })
  @HttpCode(HttpStatus.OK)
  @DefaultResponse(AuthTokenWithUserDto, 'Account Created!', HttpStatus.OK, [
    BadRequestException,
    new ConflictException('Email already registered'),
  ])
  signUp(@Body() body: SignUpBodyDto) {
    return this.authService.signUp(body);
  }

  // Three limits: per address, per address and email, and failed sign-ins
  // per email from any address (SignInFailures, password guessing).
  @Post('sign-in')
  @UseGuards(ClientAddressThrottlerGuard, SignInAccountThrottlerGuard)
  @Throttle({ default: { limit: 100, ttl: 600_000 } })
  @ApiOperation({
    summary: 'Sign in with email and password',
    description:
      '10 requests per 10 minutes for one email from one client address, and 100 per 10 minutes per client address. After 10 failed sign-ins for one email within 15 minutes, from any address, every sign-in for that email answers 429 (also with the right password) until 15 minutes after the first of them; a successful sign-in resets the count. Unknown emails are limited the same way.',
  })
  @HttpCode(HttpStatus.OK)
  @DefaultResponse(AuthTokenWithUserDto, 'Login Success', HttpStatus.OK, [
    BadRequestException,
    new ForbiddenException(INVALID_CREDENTIALS),
  ])
  signIn(@Body() body: SignInBodyDto) {
    return this.authService.signIn(body);
  }

  @Post('google')
  @UseGuards(ClientAddressThrottlerGuard)
  @Throttle({ default: { limit: 100, ttl: 600_000 } })
  @ApiOperation({
    summary: 'Sign in or sign up with Google (Firebase ID token)',
    description:
      'Answers like sign-in. Signs in the account linked to this Google account; otherwise links the account with the same email when it has no password; otherwise creates an account named after the Google profile, without a password (`has_password` false; password reset adds one). 403 with `details.code` `GOOGLE_TOKEN_REJECTED` for a token that is invalid, expired, from another Firebase project, not from Google, or without a verified email; 409 with `details.code` `PASSWORD_ACCOUNT_EXISTS` when the email belongs to an account with a password that is not linked to Google (nothing changes; confirm the password once through `POST /api/v1/auth/google/link`, sign in with the password, or reset it); 409 without `details` when the email belongs to an account linked to another Google account; 503 when Google sign-in is not configured. 100 requests per 10 minutes per client address.',
  })
  @HttpCode(HttpStatus.OK)
  @DefaultResponse(AuthTokenWithUserDto, 'Login Success', HttpStatus.OK, [
    BadRequestException,
    new ForbiddenException(GOOGLE_SIGN_IN_FAILED),
    new ConflictException(EMAIL_LINKED_TO_OTHER_GOOGLE_ACCOUNT),
    new ConflictException(PASSWORD_ACCOUNT_EXISTS_MESSAGE),
    new ServiceUnavailableException(GOOGLE_SIGN_IN_UNAVAILABLE),
  ])
  signInWithGoogle(@Body() body: GoogleSignInBodyDto) {
    return this.googleSignIn.signIn(body);
  }

  // Shares sign-in's per-email failure limit (SignInFailures), so linking
  // gives no extra password guesses.
  @Post('google/link')
  @UseGuards(ClientAddressThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 600_000 } })
  @ApiOperation({
    summary: 'Link Google to an existing password account and sign in',
    description:
      'For the 409 `PASSWORD_ACCOUNT_EXISTS` of `POST /api/v1/auth/google`: the person confirms the password of the account with the Google email once. The token is checked exactly as on `POST /api/v1/auth/google`. On success the account is linked to the Google account (its password, name, roles and data stay), and the answer is the same as sign-in; afterwards `POST /api/v1/auth/google` signs it in directly. The password is checked as on sign-in: a wrong password, or an account without a password, answers 403 with the sign-in message; every attempt counts against the sign-in failure limit of that email (10 failures within 15 minutes, from any address, then 429 also for the right password; shared with `POST /api/v1/auth/sign-in`); the master password does not link. 403 with `details.code` `GOOGLE_TOKEN_REJECTED` for a rejected token (as on `POST /api/v1/auth/google`; get a fresh token and retry); 404 when no active account has the email; 409 with `details.code` `GOOGLE_ALREADY_LINKED` when the account is already linked to this Google account (sign in with Google); 409 without `details` when it is linked to another Google account; 409 with `details.code` `GOOGLE_ACCOUNT_LINKED_ELSEWHERE` when this Google account is linked to another account; 503 when Google sign-in is not configured. 20 requests per 10 minutes per client address.',
  })
  @HttpCode(HttpStatus.OK)
  @DefaultResponse(AuthTokenWithUserDto, 'Login Success', HttpStatus.OK, [
    BadRequestException,
    new ForbiddenException(INVALID_CREDENTIALS),
    new NotFoundException(NO_ACCOUNT_TO_LINK),
    new ConflictException(GOOGLE_ALREADY_LINKED_MESSAGE),
    new ConflictException(EMAIL_LINKED_TO_OTHER_GOOGLE_ACCOUNT),
    new ConflictException(GOOGLE_ACCOUNT_LINKED_ELSEWHERE_MESSAGE),
    new ServiceUnavailableException(GOOGLE_SIGN_IN_UNAVAILABLE),
  ])
  linkGoogle(@Body() body: GoogleLinkBodyDto) {
    return this.googleSignIn.link(body);
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
