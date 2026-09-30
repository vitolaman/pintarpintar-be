import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from '../user/dto/change-password.dto';
import { SignInResDto } from './dto/sign-in.res.dto';

type AuthenticatedRequest = { user: { id: string } };

// Session actions for a signed-in user; they answer with a fresh token that
// keeps the current device signed in.
@Controller('auth')
@ApiTags('Auth')
@ApiBearerAuth()
export class AuthSessionController {
  constructor(private readonly authService: AuthService) {}

  @Post('end-other-sessions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign out every other device' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: SignInResDto,
    description: 'data.token replaces the token of this device',
  })
  endOtherSessions(@Req() req: AuthenticatedRequest) {
    return this.authService.endOtherSessions(req.user.id);
  }

  @Patch('change-password')
  @ApiOperation({
    summary: 'Change the password; other devices are signed out',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: SignInResDto,
    description: 'data.token replaces the token of this device',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Wrong current password or a weak new password',
  })
  changePassword(
    @Req() req: AuthenticatedRequest,
    @Body() input: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.id, input);
  }
}
