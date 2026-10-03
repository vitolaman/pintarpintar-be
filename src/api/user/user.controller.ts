import {
  BadRequestException,
  Body,
  Controller,
  HttpStatus,
  NotFoundException,
  Patch,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DefaultResponse } from '~/common/decorator/response.decorator';
import { UpdateCurrentUserBodyDto } from './dto/update-current-user.req.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserService } from './user.service';

@Controller('api/v1/users')
@ApiBearerAuth()
@ApiTags('User')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Patch('me')
  @ApiOperation({ summary: 'Update current user name' })
  @DefaultResponse(
    UserResponseDto,
    'Update current user success',
    HttpStatus.OK,
    [BadRequestException, new NotFoundException('User not found')],
  )
  async updateCurrentUser(
    @Req() req: { user: { id: string } },
    @Body() body: UpdateCurrentUserBodyDto,
  ) {
    return {
      data: await this.userService.updateCurrentUser(req.user.id, body.name),
      responseMessage: 'Update current user success',
    };
  }
}
