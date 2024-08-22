import {
  BadRequestException,
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  DefaultResponse,
  PaginatedResponse,
} from '~/common/decorator/response.decorator';
import { RequestPaginatedQueryWithSearchDto } from '~/common/dto/request-paginated.dto';
import { FindOneUserParamDto } from './dto/find-one-user.req.dto';
import { User } from './entities/user.entity';
import { UserService } from './user.service';

@Controller('users')
@ApiBearerAuth()
@ApiTags('User')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':id')
  @ApiOperation({
    summary: 'Get profile by ID',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @DefaultResponse(User, HttpStatus.OK, [
    BadRequestException,
    NotFoundException,
    UnauthorizedException,
  ])
  findById(@Param() param: FindOneUserParamDto) {
    const { id } = param;
    return this.userService.findById(id);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all profile',
  })
  @PaginatedResponse(User, [BadRequestException])
  findAllUsers(@Query() query: RequestPaginatedQueryWithSearchDto) {
    return this.userService.findAllUssers(query);
  }
}
