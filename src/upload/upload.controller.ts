import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  InternalServerErrorException,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { ApiException } from '@nanogiants/nestjs-swagger-api-exception-decorator';
import { isOwnUploadKey } from '~/common/storage/upload-key';
import { UploadService } from './upload.service';
import { InitiateUploadDto } from './dto/initiate-upload.dto';
import { PresignedUrlDto } from './dto/presigned-url.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import {
  CompleteUploadResponseDto,
  InitiateUploadResponseDto,
  PresignedPartUrlDto,
} from './dto/upload-response.dto';

type AuthenticatedRequest = { user: { id: string } };

const uploadErrors = () =>
  ApiException(() => [
    BadRequestException,
    ForbiddenException,
    InternalServerErrorException,
  ]);

// S3 multipart upload: initiate, PUT each part to a presigned URL, complete.
// Keys belong to the user who initiated them.
@ApiTags('Upload')
@ApiBearerAuth()
@Controller('api/v1/upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('initiate')
  @ApiCreatedResponse({ type: InitiateUploadResponseDto })
  @uploadErrors()
  async initiateUpload(
    @Req() req: AuthenticatedRequest,
    @Body() dto: InitiateUploadDto,
  ) {
    return this.uploadService.initiateMultipartUpload(
      req.user.id,
      dto.fileName,
      dto.contentType,
    );
  }

  @Post('presigned-urls')
  @ApiCreatedResponse({ type: [PresignedPartUrlDto] })
  @uploadErrors()
  async getPresignedUrls(
    @Req() req: AuthenticatedRequest,
    @Body() dto: PresignedUrlDto,
  ) {
    assertOwnKey(dto.key, req.user.id);
    return this.uploadService.getPresignedUrls(
      dto.key,
      dto.uploadId,
      dto.partsCount,
    );
  }

  @Post('complete')
  @ApiCreatedResponse({ type: CompleteUploadResponseDto })
  @uploadErrors()
  async completeUpload(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CompleteUploadDto,
  ) {
    assertOwnKey(dto.key, req.user.id);
    return this.uploadService.completeMultipartUpload(
      dto.key,
      dto.uploadId,
      dto.parts,
    );
  }
}

function assertOwnKey(key: string, userId: string): void {
  if (!isOwnUploadKey(key, userId)) {
    throw new ForbiddenException('This upload belongs to another user');
  }
}
