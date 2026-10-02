import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '~/common/decorator/public.decorator';
import { DefaultResponse } from '~/common/decorator/response.decorator';
import { AuthService } from './auth.service';
import { AuthTokenDto } from './dto/auth-token.dto';
import { SignInBodyDto } from './dto/sign-in.req.dto';
import { SignUpBodyDto } from './dto/sign-up.req.dto';

@Controller('api/v1/auth')
@ApiTags('Auth')
@Public()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sign-up')
  @ApiOperation({
    summary: 'User sign up',
  })
  @HttpCode(HttpStatus.OK)
  @DefaultResponse(AuthTokenDto, 'Account Created!', HttpStatus.OK, [
    BadRequestException,
    ConflictException,
  ])
  signUp(@Body() body: SignUpBodyDto) {
    return this.authService.signUp(body);
  }

  @Post('sign-in')
  @ApiOperation({
    summary: 'Sign in with email and password',
  })
  @HttpCode(HttpStatus.OK)
  @DefaultResponse(AuthTokenDto, 'Login Success', HttpStatus.OK, [
    BadRequestException,
    ForbiddenException,
  ])
  signIn(@Body() body: SignInBodyDto) {
    return this.authService.signIn(body);
  }
}
