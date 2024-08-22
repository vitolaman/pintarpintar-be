import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  DefaultResponse,
  EmptyResponse,
} from '~/common/decorator/response.decorator';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { MulterConfigService } from '~/config/multer.config';
import { Express, Response } from 'express';

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
    console.log(req);
    return this.userService.findMe(req.user.id);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @EmptyResponse([UnauthorizedException])
  async delete(@Req() req) {
    return this.userService.delete(req.user.id);
  }

  @Post('complete-profile')
  @ApiOperation({
    summary: 'User Complete Profile',
  })
  @ApiResponse({
    status: 200,
    description: 'Success',
    schema: {
      example: {
        responseMessage: 'Complete Profile Success!',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Not Found',
    schema: {
      example: {
        responseMessage: 'User not found',
      },
    },
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Complete profile data',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'John Doe' },
        phone: { type: 'string', example: '123-456-7890' },
        dob: { type: 'string', example: '1990-01-01' },
        countryId: { type: 'number', example: 1 },
        picture: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('picture', MulterConfigService.getMulterConfig()),
  )
  completeProfile(
    @Req() req,
    @Body() body: CompleteProfileDto,
    @UploadedFile() picture: Express.Multer.File,
    @Res() res: Response,
  ) {
    return this.userService.completeProfile(body, picture, req.user.id, res);
  }
}
