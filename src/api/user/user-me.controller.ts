import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  DefaultResponse,
  EmptyResponse,
} from '~/common/decorator/response.decorator';
import { UserService } from './user.service';
import { User } from './entities/user.entity';

@Controller('users/me')
@ApiBearerAuth()
@ApiTags('User')
export class UserMeController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({
    summary: 'Get current profile',
  })
  @DefaultResponse(User, HttpStatus.OK, [
    NotFoundException,
    UnauthorizedException,
  ])
  findOne(@Req() req) {
    return this.userService.findMe(req.user.id);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @EmptyResponse([UnauthorizedException])
  async delete(@Req() req) {
    return this.userService.delete(req.user.id);
  }
}
