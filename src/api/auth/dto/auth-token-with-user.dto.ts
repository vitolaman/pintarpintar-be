import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../user/dto/user-response.dto';
import { AuthTokenDto } from './auth-token.dto';

// Sign-up and sign-in also return the account, so the client needs no
// GET /api/v1/users/me after them.
export class AuthTokenWithUserDto extends AuthTokenDto {
  @ApiProperty({
    type: UserResponseDto,
    description: 'Same shape as GET /api/v1/users/me',
  })
  user: UserResponseDto;
}
