import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Patch,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ArrayResponse,
  DefaultResponse,
} from '~/common/decorator/response.decorator';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  LearningItemResponseDto,
  ProfileResponseDto,
} from './dto/profile-response.dto';

@Controller('profile/v1')
@ApiBearerAuth()
@ApiTags('Profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('get-profile')
  @DefaultResponse(ProfileResponseDto, 'Get profile success', HttpStatus.OK, [
    NotFoundException,
  ])
  findCurrent(@Req() req: { user: { id: string } }) {
    return this.profileService.findCurrent(req.user.id);
  }

  @Patch('update-profile')
  @DefaultResponse(
    ProfileResponseDto,
    'Update profile success',
    HttpStatus.OK,
    [BadRequestException, NotFoundException],
  )
  updateCurrent(
    @Req() req: { user: { id: string } },
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.profileService.updateCurrent(req.user.id, updateProfileDto);
  }

  @Get('get-learning')
  @ArrayResponse(LearningItemResponseDto, 'Get learning success', [
    NotFoundException,
  ])
  findLearning(@Req() req: { user: { id: string } }) {
    return this.profileService.findLearning(req.user.id);
  }
}
