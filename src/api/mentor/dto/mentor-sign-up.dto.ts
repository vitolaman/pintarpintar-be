import { ApiProperty, IntersectionType } from '@nestjs/swagger';
import { CreateUserBodyDto } from '~/api/user/dto/create-user.req.dto';
import { MentorRegistrationDto } from './mentor-registration.dto';

export class MentorSignUpDto extends IntersectionType(
  CreateUserBodyDto,
  MentorRegistrationDto,
) {

  @ApiProperty({ type: 'string', format: 'binary' })
  cv: unknown;

  @ApiProperty({ type: 'string', format: 'binary' })
  skill_certificate: unknown;
}

export class MentorRegisterDto extends MentorRegistrationDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  cv: unknown;

  @ApiProperty({ type: 'string', format: 'binary' })
  skill_certificate: unknown;
}

export interface MentorSignUpInput extends MentorRegistrationDto {
  name: string;
  email: string;
  password: string;
}
