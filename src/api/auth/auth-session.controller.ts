import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DefaultResponse } from '~/common/decorator/response.decorator';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from '../user/dto/change-password.dto';
import { AuthTokenDto } from './dto/auth-token.dto';

type AuthenticatedRequest = { user: { id: string } };

// Session actions for a signed-in user; they answer with a fresh token that
// keeps the current device signed in.
@Controller('api/v1/auth')
@ApiTags('Auth')
@ApiBearerAuth()
export class AuthSessionController {
  constructor(private readonly authService: AuthService) {}

  @Post('end-other-sessions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign out every other device',
    description: 'data.token replaces the token of this device',
  })
  @DefaultResponse(AuthTokenDto, 'Other sessions ended', HttpStatus.OK, [])
  endOtherSessions(@Req() req: AuthenticatedRequest) {
    return this.authService.endOtherSessions(req.user.id);
  }

  @Patch('password')
  @ApiOperation({
    summary: 'Change the password; other devices are signed out',
    description:
      'data.token replaces the token of this device. 400 for a wrong current password, a weak new password, or a new password equal to the current one',
  })
  @DefaultResponse(AuthTokenDto, 'Password changed', HttpStatus.OK, [
    BadRequestException,
  ])
  changePassword(
    @Req() req: AuthenticatedRequest,
    @Body() input: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.id, input);
  }
}
