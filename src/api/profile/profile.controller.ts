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
import { NotificationPreferencesService } from '../notification-preferences/notification-preferences.service';
import { EmailPreferencesResponseDto } from '../notification-preferences/dto/email-preferences-response.dto';
import { UpdateEmailPreferencesDto } from '../notification-preferences/dto/update-email-preferences.dto';
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

const USER_NOT_FOUND = new NotFoundException('User not found');

@Controller('api/v1')
@ApiBearerAuth()
@ApiTags('Profile')
export class ProfileController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly notificationPreferences: NotificationPreferencesService,
  ) {}

  @Get('profile/notification-preferences')
  @DefaultResponse(
    EmailPreferencesResponseDto,
    'Get email notification preferences success',
    HttpStatus.OK,
    [USER_NOT_FOUND],
  )
  findNotificationPreferences(@Req() req: { user: { id: string } }) {
    return this.notificationPreferences.findEmailPreferences(req.user.id);
  }

  @Patch('profile/notification-preferences')
  @DefaultResponse(
    EmailPreferencesResponseDto,
    'Update email notification preferences success',
    HttpStatus.OK,
    [BadRequestException, USER_NOT_FOUND],
  )
  updateNotificationPreferences(
    @Req() req: { user: { id: string } },
    @Body() input: UpdateEmailPreferencesDto,
  ) {
    return this.notificationPreferences.updateEmailPreferences(
      req.user.id,
      input,
    );
  }

  @Get('profile')
  @DefaultResponse(ProfileResponseDto, 'Get profile success', HttpStatus.OK, [
    USER_NOT_FOUND,
  ])
  findCurrent(@Req() req: { user: { id: string } }) {
    return this.profileService.findCurrent(req.user.id);
  }

  @Patch('profile')
  @DefaultResponse(
    ProfileResponseDto,
    'Update profile success',
    HttpStatus.OK,
    [BadRequestException, USER_NOT_FOUND],
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
    [BadRequestException, USER_NOT_FOUND],
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
    [BadRequestException, USER_NOT_FOUND],
  )
  findPublicProfile(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.profileService.findPublicProfile(userId);
  }

  @Get('profile/learning')
  @ArrayResponse(LearningItemResponseDto, 'Get learning success')
  findLearning(@Req() req: { user: { id: string } }) {
    return this.profileService.findLearning(req.user.id);
  }

  @Get('profile/certificates')
  @ArrayResponse(CertificationItemResponseDto, 'Get certifications success')
  findCertifications(@Req() req: { user: { id: string } }) {
    return this.profileService.findCertifications(req.user.id);
  }

  @Get('profile/statistics')
  @DefaultResponse(
    LearningStatisticsResponseDto,
    'Get learning statistics success',
    HttpStatus.OK,
    [],
  )
  findStatistics(@Req() req: { user: { id: string } }) {
    return this.profileService.findStatistics(req.user.id);
  }
}
