import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { FileAsset } from './entities/file-asset.entity';
import { Product } from './entities/product.entity';
import { Profile } from './entities/profile.entity';
import { StudentProgress } from './entities/student-progress.entity';
import { UserAccess } from './entities/user-access.entity';
import { User } from '../user/entities/user.entity';
import { MentorModule } from '../mentor/mentor.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FileAsset,
      Product,
      Profile,
      StudentProgress,
      User,
      UserAccess,
    ]),
    MentorModule,
  ],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
