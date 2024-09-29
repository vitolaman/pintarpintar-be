import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminSignInBodyDto } from './dto/admin-sign-in.dto';
import { AdminService } from './admin.service';
import { Public } from '~/common/decorator/public.decorator';

@Controller('admins')
@ApiTags('Admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('sign-in')
  @Public()
  @ApiOperation({
    summary: 'Sign in with email and password',
  })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: 200,
    description: 'Success',
    schema: {
      example: {
        responseMessage: 'Login Success',
        data: {
          token: 'string',
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'FORBIDDEN',
    schema: {
      example: {
        responseMessage: ['invalid email or password'],
        error: 'FORBIDDEN',
        statusCode: 403,
      },
    },
  })
  signIn(@Body() body: AdminSignInBodyDto) {
    return this.adminService.signIn(body);
  }
}
