import { Controller, Delete, Get, HttpStatus, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserService } from './user.service';

@Controller('users/me')
@ApiBearerAuth()
@ApiTags('User')
export class UserMeController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Current user profile' })
  findOne(@Req() req: { user: { id: string } }) {
    return this.userService.findCurrentUser(req.user.id);
  }

  @Delete()
  @ApiOperation({ summary: 'Soft-delete current user account' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Deleted current user' })
  delete(@Req() req: { user: { id: string } }) {
    return this.userService.deleteCurrentUser(req.user.id);
  }
}
