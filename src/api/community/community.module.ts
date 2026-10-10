import { Module } from '@nestjs/common';
import { CommunityGroupController } from './community-group.controller';
import { CommunityGroupService } from './community-group.service';
import { CommunityThreadController } from './community-thread.controller';
import { CommunityThreadService } from './community-thread.service';

@Module({
  controllers: [CommunityGroupController, CommunityThreadController],
  providers: [CommunityGroupService, CommunityThreadService],
})
export class CommunityModule {}
