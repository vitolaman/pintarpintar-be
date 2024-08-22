import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
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
import { Response } from 'express';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyForgotPasswordOtpDto } from './dto/verify-forgot-password-otp.dto';

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

  @Post('/forgot-password')
  @ApiOperation({
    summary: 'Forgot Password',
  })
  @ApiResponse({
    status: 200,
    description: 'Success',
    schema: {
      example: {
        response: 'OTP Sent Successfully!',
      },
    },
  })
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
    @Res() res: Response,
  ) {
    const response = await this.userService.forgotPassword(
      forgotPasswordDto.email,
      res,
    );

    return response;
  }

  @Post('/verify-forgot-password-otp')
  @ApiOperation({
    summary: 'Verify Forgot Password OTP',
  })
  @ApiResponse({
    status: 200,
    description: 'Success',
    schema: {
      example: {
        responseMessage: 'Successful OTP Verification!',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    schema: {
      example: {
        responseMessage: 'Wrong OTP / Not Found!',
      },
    },
  })
  async verifyForgotPasswordOtp(
    @Body() verifyForgotPasswordOtpDto: VerifyForgotPasswordOtpDto,
    @Res() res: Response,
  ) {
    const response = await this.userService.verifyForgotPasswordOtp(
      verifyForgotPasswordOtpDto,
      res,
    );
    return response;
  }
}
