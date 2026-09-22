import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { InitiateUploadDto } from './dto/initiate-upload.dto';
import { PresignedUrlDto } from './dto/presigned-url.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';

@ApiTags('Upload')
@ApiBearerAuth()
@Controller('api/v1/upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('initiate')
  async initiateUpload(@Body() dto: InitiateUploadDto) {
    return this.uploadService.initiateMultipartUpload(dto.fileName, dto.contentType);
  }

  @Post('presigned-urls')
  async getPresignedUrls(@Body() dto: PresignedUrlDto) {
    return this.uploadService.getPresignedUrls(dto.key, dto.uploadId, dto.partsCount);
  }

  @Post('complete')
  async completeUpload(@Body() dto: CompleteUploadDto) {
    return this.uploadService.completeMultipartUpload(dto.key, dto.uploadId, dto.parts);
  }
}
