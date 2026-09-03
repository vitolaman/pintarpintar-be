import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Patch,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UpdateCurrentUserBodyDto } from './dto/update-current-user.req.dto';
import { UserService } from './user.service';

@Controller('users')
@ApiBearerAuth()
@ApiTags('User')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Get current user profile',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Current user profile' })
  findCurrentUser(@Req() req: { user: { id: string } }) {
    return this.userService.findCurrentUser(req.user.id);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Update current user name',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Updated current user' })
  updateCurrentUser(
    @Req() req: { user: { id: string } },
    @Body() body: UpdateCurrentUserBodyDto,
  ) {
    return this.userService.updateCurrentUser(req.user.id, body.name);
  }

  @Delete('me')
  @ApiOperation({
    summary: 'Soft-delete current user account',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Deleted current user' })
  deleteCurrentUser(@Req() req: { user: { id: string } }) {
    return this.userService.deleteCurrentUser(req.user.id);
  }
}
