import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { FileAsset } from '../profile/entities/file-asset.entity';
import { Profile } from '../profile/entities/profile.entity';
import { UserModule } from '../user/user.module';
import { MentorService } from './mentor.service';
import { MentorController } from './mentor.controller';
import { MentorDocumentStorageService } from './mentor-document-storage.service';
import { Mentor } from './entities/mentor.entity';
import { MentorProfile } from './entities/mentor-profile.entity';

@Module({
  imports: [
    AuthModule,
    UserModule,
    TypeOrmModule.forFeature([FileAsset, Mentor, MentorProfile, Profile]),
  ],
  controllers: [MentorController],
  providers: [MentorDocumentStorageService, MentorService],
})
export class MentorModule {}
