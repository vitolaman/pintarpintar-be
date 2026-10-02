import {
  Controller,
  Delete,
  Get,
  HttpStatus,
  NotFoundException,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DefaultResponse } from '~/common/decorator/response.decorator';
import { UserResponseDto } from './dto/user-response.dto';
import { UserService } from './user.service';

@Controller('api/v1/users/me')
@ApiBearerAuth()
@ApiTags('User')
export class UserMeController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user profile' })
  @DefaultResponse(UserResponseDto, 'Get current user success')
  async findOne(@Req() req: { user: { id: string } }) {
    return {
      data: await this.userService.findCurrentUser(req.user.id),
      responseMessage: 'Get current user success',
    };
  }

  @Delete()
  @ApiOperation({
    summary: 'Soft-delete the current account',
    description:
      'Frees the email for a new sign-up and deactivates the user merchant',
  })
  @DefaultResponse(
    UserResponseDto,
    'Delete current user success',
    HttpStatus.OK,
    [NotFoundException],
  )
  async delete(@Req() req: { user: { id: string } }) {
    return {
      data: await this.userService.deleteCurrentUser(req.user.id),
      responseMessage: 'Delete current user success',
    };
  }
}
