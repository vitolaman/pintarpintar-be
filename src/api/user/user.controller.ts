import { Body, Controller, HttpStatus, Patch, Req } from '@nestjs/common';
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
}
