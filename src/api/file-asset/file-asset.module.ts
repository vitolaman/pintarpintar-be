import { Module } from '@nestjs/common';
import { FileAssetService } from './file-asset.service';

@Module({
  providers: [FileAssetService],
  exports: [FileAssetService],
})
export class FileAssetModule {}
