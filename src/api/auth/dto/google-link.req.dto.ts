import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { GoogleSignInBodyDto } from './google-sign-in.req.dto';

export class GoogleLinkBodyDto extends GoogleSignInBodyDto {
  // Passwords are never trimmed: spaces are part of the secret.
  @ApiProperty({
    description:
      'The current password of the account with the Google email, as on sign-in.',
    example: 'qwerty1!',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}
