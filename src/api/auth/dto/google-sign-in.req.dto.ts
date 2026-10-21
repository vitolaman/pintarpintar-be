import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class GoogleSignInBodyDto {
  // Sent as the client received it: a token is never trimmed.
  @ApiProperty({
    description:
      'The Firebase ID token from the Firebase web SDK after a Google sign-in (`user.getIdToken()`).',
    maxLength: 4096,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  id_token: string;
}
