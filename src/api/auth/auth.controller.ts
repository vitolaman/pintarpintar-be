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
import { AuthTokenWithUserDto } from './dto/auth-token-with-user.dto';
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
}
