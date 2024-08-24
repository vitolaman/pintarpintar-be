import {
  BadRequestException,
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
import { UpdateSocialTokenDto } from './dto/update-social-token.req.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('users/me')
@ApiBearerAuth()
@ApiTags('User')
export class UserMeController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({
    summary: 'Get current profile',
  })
  @DefaultResponse(User, 'Get current profile succes', HttpStatus.OK, [
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

  @Post('edit-profile')
  @DefaultResponse(User, 'Update profile success ', HttpStatus.OK, [
    NotFoundException,
    UnauthorizedException,
  ])
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
  editProfile(
    @Req() req,
    @Body() body: CompleteProfileDto,
    @UploadedFile() picture: Express.Multer.File,
  ) {
    return this.userService.editProfile(body, picture, req.user.id);
  }

  @Post('update-social-token')
  @DefaultResponse(User, 'Update social token success', HttpStatus.OK, [
    NotFoundException,
    UnauthorizedException,
    BadRequestException,
  ])
  updateSocialToken(@Req() req, @Body() body: UpdateSocialTokenDto) {
    return this.userService.updateSocialToken(body, req.user.id);
  }

  @Post('change-password')
  @ApiResponse({
    status: 200,
    description: 'Success',
    schema: {
      example: {
        responseMessage: 'Change Password Success',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found',
    schema: {
      example: {
        responseMessage: 'User not found',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    schema: {
      example: {
        responseMessage: 'Old Password is incorrect',
      },
    },
  })
  async changePassword(
    @Req() req,
    @Body() body: ChangePasswordDto,
    @Res() res: Response,
  ) {
    return await this.userService.changePassword(body, req.user.id, res);
  }
}
