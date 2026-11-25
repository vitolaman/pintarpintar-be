import {
  BadGatewayException,
  ConflictException,
  Body,
  Controller,
  ForbiddenException,
  InternalServerErrorException,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiException } from '@nanogiants/nestjs-swagger-api-exception-decorator';
import { isOwnUploadKey } from '~/common/storage/upload-key';
import { UploadService } from './upload.service';
import { FileAssetService } from '~/api/file-asset/file-asset.service';
import {
  LARGEST_FIXED_UPLOAD_BYTES,
  uploadSizeCapDescription,
  uploadTooLarge,
} from '~/api/file-asset/upload-size-cap';
import { InitiateUploadDto } from './dto/initiate-upload.dto';
import { PresignedUrlDto } from './dto/presigned-url.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import {
  CompleteUploadResponseDto,
  InitiateUploadResponseDto,
  PresignedPartUrlDto,
} from './dto/upload-response.dto';

type AuthenticatedRequest = { user: { id: string } };

const ANOTHER_USERS_UPLOAD = new ForbiddenException(
  'This upload belongs to another user',
);

// S3 multipart upload: initiate, PUT each part to a presigned URL, complete.
// Keys belong to the user who initiated them. Completing also registers the
// file and returns its asset_id for the form field it is meant for. A file
// larger than any field could accept from the caller is refused: by its
// declared size at initiate, and by its stored size at complete.
const SIZE_CAP_NOTE = uploadSizeCapDescription();
const UPLOAD_TOO_LARGE = uploadTooLarge(LARGEST_FIXED_UPLOAD_BYTES);
@ApiTags('Upload')
@ApiBearerAuth()
@Controller('api/v1/upload')
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly fileAssetService: FileAssetService,
  ) {}

  @Post('initiate')
  @ApiOperation({
    summary: 'Start a multipart upload',
    description: SIZE_CAP_NOTE,
  })
  @ApiCreatedResponse({ type: InitiateUploadResponseDto })
  @ApiException(() => [
    UPLOAD_TOO_LARGE,
    new InternalServerErrorException('Failed to initiate multipart upload'),
  ])
  async initiateUpload(
    @Req() req: AuthenticatedRequest,
    @Body() dto: InitiateUploadDto,
  ) {
    if (dto.fileSize !== undefined) {
      await this.fileAssetService.assertUploadSizeAllowed(
        req.user.id,
        dto.fileSize,
      );
    }
    return this.uploadService.initiateMultipartUpload(
      req.user.id,
      dto.fileName,
      dto.contentType,
    );
  }

  @Post('presigned-urls')
  @ApiCreatedResponse({ type: [PresignedPartUrlDto] })
  @ApiException(() => [
    ANOTHER_USERS_UPLOAD,
    new InternalServerErrorException('Failed to generate presigned URLs'),
  ])
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
  @ApiOperation({
    summary: 'Complete a multipart upload and register it as a file',
    description: `${SIZE_CAP_NOTE} A stored file over the limit is deleted and answers 400; a failed completion is aborted, so its parts are not kept.`,
  })
  @ApiCreatedResponse({ type: CompleteUploadResponseDto })
  @ApiException(() => [
    ANOTHER_USERS_UPLOAD,
    UPLOAD_TOO_LARGE,
    new ConflictException('This upload is already registered'),
    new InternalServerErrorException('Failed to complete multipart upload'),
    new BadGatewayException('File storage is unavailable'),
  ])
  async completeUpload(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CompleteUploadDto,
  ) {
    assertOwnKey(dto.key, req.user.id);
    const completed = await this.uploadService.completeMultipartUpload(
      dto.key,
      dto.uploadId,
      dto.parts,
    );
    const asset = await this.fileAssetService.registerCompleted(
      req.user.id,
      dto.key,
    );
    return { ...completed, asset_id: asset.id };
  }
}

function assertOwnKey(key: string, userId: string): void {
  if (!isOwnUploadKey(key, userId)) {
    throw new ForbiddenException('This upload belongs to another user');
  }
}
