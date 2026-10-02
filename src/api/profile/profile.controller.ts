import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ArrayResponse,
  DefaultResponse,
} from '~/common/decorator/response.decorator';
import { Public } from '~/common/decorator/public.decorator';
import { ProfileService } from './profile.service';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  OnboardingResponseDto,
  CertificationItemResponseDto,
  LearningItemResponseDto,
  ProfileResponseDto,
  LearningStatisticsResponseDto,
  PublicProfileResponseDto,
} from './dto/profile-response.dto';

@Controller('api/v1')
@ApiBearerAuth()
@ApiTags('Profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('profile')
  @DefaultResponse(ProfileResponseDto, 'Get profile success', HttpStatus.OK, [
    NotFoundException,
  ])
  findCurrent(@Req() req: { user: { id: string } }) {
    return this.profileService.findCurrent(req.user.id);
  }

  @Patch('profile')
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

  @Put('profile/onboarding')
  @DefaultResponse(
    OnboardingResponseDto,
    'Update onboarding success',
    HttpStatus.OK,
    [BadRequestException, NotFoundException],
  )
  updateOnboarding(
    @Req() req: { user: { id: string } },
    @Body() input: UpdateOnboardingDto,
  ) {
    return this.profileService.updateOnboarding(req.user.id, input);
  }

  // Public profile page (/profile/{id}); no email or phone.
  @Public()
  @Get('users/:userId/profile')
  @DefaultResponse(
    PublicProfileResponseDto,
    'Get public profile success',
    HttpStatus.OK,
    [BadRequestException, NotFoundException],
  )
  findPublicProfile(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.profileService.findPublicProfile(userId);
  }

  @Get('profile/learning')
  @ArrayResponse(LearningItemResponseDto, 'Get learning success', [
    NotFoundException,
  ])
  findLearning(@Req() req: { user: { id: string } }) {
    return this.profileService.findLearning(req.user.id);
  }

  @Get('profile/certificates')
  @ArrayResponse(CertificationItemResponseDto, 'Get certifications success', [
    NotFoundException,
  ])
  findCertifications(@Req() req: { user: { id: string } }) {
    return this.profileService.findCertifications(req.user.id);
  }

  @Get('profile/statistics')
  @DefaultResponse(
    LearningStatisticsResponseDto,
    'Get learning statistics success',
  )
  findStatistics(@Req() req: { user: { id: string } }) {
    return this.profileService.findStatistics(req.user.id);
  }
}
