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
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
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
import { Response } from 'express';
import { UpdateSocialTokenDto } from './dto/update-social-token.req.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RequestPaginatedQueryDto } from '~/common/dto/request-paginated.dto';
import { UpdateWalletAddressDto } from './dto/update-wallet-address.req.dto';
import { UploadPfpDto } from './dto/upload-pfp.dto';

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

  @Post('upload-pfp')
  @ApiOperation({
    summary: 'Upload Profile Picture',
  })
  @ApiResponse({
    status: 200,
    description: 'Success',
    schema: {
      example: {
        responseMessage: 'Upload Profile Picture Succeess!',
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
  uploadProfilePic(
    @Req() req,
    @Body() body: UploadPfpDto,
    @Res() res: Response,
  ) {
    return this.userService.uploadProfilePic(
      body.profilePicUrl,
      req.user.id,
      res,
    );
  }

  // Ini upload pfp file beneran
  // @Post('upload-pfp')
  // @ApiOperation({
  //   summary: 'Upload Profile Picture',
  // })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Success',
  //   schema: {
  //     example: {
  //       responseMessage: 'Upload Profile Picture Succeess!',
  //     },
  //   },
  // })
  // @ApiResponse({
  //   status: HttpStatus.NOT_FOUND,
  //   description: 'Not Found',
  //   schema: {
  //     example: {
  //       responseMessage: 'User not found',
  //     },
  //   },
  // })
  // @ApiConsumes('multipart/form-data')
  // @ApiBody({
  //   description: 'Upload Profile Picture',
  //   schema: {
  //     type: 'object',
  //     properties: {
  //       picture: {
  //         type: 'string',
  //         format: 'binary',
  //       },
  //     },
  //   },
  // })
  // @UseInterceptors(
  //   FileInterceptor('picture', MulterConfigService.getMulterConfig()),
  // )
  // uploadProfilePic(
  //   @Req() req,
  //   @UploadedFile() picture: Express.Multer.File,
  //   @Res() res: Response,
  // ) {
  //   const host = req.headers.host;
  //   const protocol = req.protocol;
  //   const webLink = `${protocol}://${host}`;

  //   return this.userService.uploadProfilePic(
  //     webLink,
  //     picture,
  //     req.user.id,
  //     res,
  //   );
  // }

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
  completeProfile(
    @Req() req,
    @Body() body: CompleteProfileDto,
    @Res() res: Response,
  ) {
    return this.userService.completeProfile(body, req.user.id, res);
  }

  @Post('edit-profile')
  @DefaultResponse(User, 'Update profile success ', HttpStatus.OK, [
    NotFoundException,
    UnauthorizedException,
  ])
  @ApiBody({
    description: 'Complete profile data',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'John Doe' },
        phone: { type: 'string', example: '123-456-7890' },
        dob: { type: 'string', example: '1990-01-01' },
        countryId: { type: 'string', example: '1' },
      },
    },
  })
  editProfile(@Req() req, @Body() body: CompleteProfileDto) {
    return this.userService.editProfile(body, req.user.id);
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

  @Post('update-wallet-address')
  @DefaultResponse(User, 'Update wallet address success', HttpStatus.OK, [
    NotFoundException,
    UnauthorizedException,
    BadRequestException,
  ])
  updateWalletAddress(@Req() req, @Body() body: UpdateWalletAddressDto) {
    return this.userService.updateWalletAddress(body, req.user.id);
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

  @Get('referral-list')
  @ApiResponse({
    status: 200,
    description: 'Success',
    schema: {
      example: {
        data: [
          {
            reffId: '9cd07519-aa6f-4f43-b7dc-52613210e488',
            username: 'thehashslingingslasher',
            createdAt: '2024-08-24T06:12:16.635Z',
          },
          {
            reffId: '6dc9723c-c92f-4391-8ff1-72cd3979051c',
            username: 'invipirate2',
            createdAt: '2024-08-24T06:11:53.006Z',
          },
        ],
        meta: {
          page: 1,
          per_page: 10,
          total: 2,
          total_page: 1,
        },
        responseMessage: 'Get Referral list success',
      },
    },
  })
  async referralList(@Req() req, @Query() query: RequestPaginatedQueryDto) {
    return this.userService.referralList(query, req.user.id);
  }
}
