import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '~/common/decorator/public.decorator';
import { DefaultResponse } from '~/common/decorator/response.decorator';
import { MentorAssignmentsResponseDto, MentorResponseDto, PublicMentorResponseDto } from './dto/mentor-response.dto';
import { MentorRegistrationDto } from './dto/mentor-registration.dto';
import { MentorRegisterDto, MentorSignUpDto } from './dto/mentor-sign-up.dto';
import { UpdateMentorDto } from './dto/update-mentor.dto';
import { MentorService } from './mentor.service';

const mentorDocuments = FileFieldsInterceptor([
  { name: 'cv', maxCount: 1 },
  { name: 'skill_certificate', maxCount: 1 },
], { limits: { fileSize: 5 * 1024 * 1024 } });

@Controller('mentors/v1')
@ApiTags('Mentors')
export class MentorController {
  constructor(private readonly mentorService: MentorService) {}

  @Post('sign-up')
  @Public()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(mentorDocuments)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: MentorSignUpDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Account Created!' })
  signUp(@Body() input: MentorSignUpDto, @UploadedFiles() files: Record<string, Express.Multer.File[]>) {
    return this.mentorService.signUp(input, files);
  }

  @Post('register')
  @ApiBearerAuth()
  @UseInterceptors(mentorDocuments)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: MentorRegisterDto })
  @DefaultResponse(MentorResponseDto, 'Register mentor success', HttpStatus.CREATED)
  register(@Req() req: { user: { id: string } }, @Body() input: MentorRegistrationDto, @UploadedFiles() files: Record<string, Express.Multer.File[]>) {
    return this.mentorService.register(req.user.id, input, files);
  }

  @Get('get-mentor/:id')
  @Public()
  @DefaultResponse(PublicMentorResponseDto, 'Get mentor success')
  findPublicMentor(@Param('id') id: string) {
    return this.mentorService.findPublicMentor(id);
  }

  @Get('get-profile')
  @ApiBearerAuth()
  @DefaultResponse(MentorResponseDto, 'Get mentor profile success')
  findProfile(@Req() req: { user: { id: string } }) {
    return this.mentorService.findProfile(req.user.id);
  }

  @Patch('update-profile')
  @ApiBearerAuth()
  @DefaultResponse(MentorResponseDto, 'Update mentor profile success')
  updateProfile(@Req() req: { user: { id: string } }, @Body() input: UpdateMentorDto) {
    return this.mentorService.updateMyMentor(req.user.id, input);
  }

  @Get('get-assignments')
  @ApiBearerAuth()
  @DefaultResponse(MentorAssignmentsResponseDto, 'Get mentor assignments success')
  findAssignments(@Req() req: { user: { id: string } }) {
    return this.mentorService.findAssignments(req.user.id);
  }
}
