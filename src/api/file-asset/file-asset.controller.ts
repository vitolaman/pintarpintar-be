import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DefaultResponse } from '~/common/decorator/response.decorator';
import {
  FileAssetResponseDto,
  RegisterUploadDto,
} from './dto/register-upload.dto';
import { FileAssetService } from './file-asset.service';

@Controller('file-assets/v1')
@ApiBearerAuth()
@ApiTags('File Assets')
export class FileAssetController {
  constructor(private readonly fileAssetService: FileAssetService) {}

  @Post('register-upload')
  @DefaultResponse(
    FileAssetResponseDto,
    'Register upload success',
    HttpStatus.CREATED,
    [BadRequestException, ConflictException],
  )
  registerUpload(
    @Req() req: { user: { id: string } },
    @Body() input: RegisterUploadDto,
  ) {
    return this.fileAssetService.registerUpload(req.user.id, input);
  }
}
