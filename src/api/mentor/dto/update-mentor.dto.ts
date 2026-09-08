import { PartialType } from '@nestjs/swagger';
import { MentorRegistrationDto } from './mentor-registration.dto';

export class UpdateMentorDto extends PartialType(MentorRegistrationDto) {}
