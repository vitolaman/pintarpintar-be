import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsStrongPassword, ValidateIf } from 'class-validator';
import { CreateUserBodyDto } from './create-user.req.dto';

export class UpdateUserBodyDto extends PartialType(CreateUserBodyDto) {
  @ApiProperty({ example: 'qwerty1!' })
  @ValidateIf((_) => _.password)
  @IsStrongPassword(
    {
      minLength: 8,
      minNumbers: 1,
      minSymbols: 0,
      minLowercase: 0,
      minUppercase: 0,
    },
    {
      message: ({ value }) =>
        value
          ? 'old_password is not strong enough'
          : 'old_password should not be empty',
    },
  )
  old_password?: string;
}
