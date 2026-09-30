import { Module } from '@nestjs/common';
import { FileAssetController } from './file-asset.controller';
import { FileAssetService } from './file-asset.service';

@Module({
  controllers: [FileAssetController],
  providers: [FileAssetService],
})
export class FileAssetModule {}
