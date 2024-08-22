import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import * as moment from 'moment';

export class CompleteProfileDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'validation.NOT_EMPTY' })
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'validation.NOT_EMPTY' })
  phone: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'validation.NOT_EMPTY' })
  @Transform(({ value }) => {
    const isValid = moment(value, 'YYYY-MM-DD', true).isValid();
    if (!isValid) {
      throw new Error('Date of birth must be in the format YYYY-MM-DD');
    }
    return value;
  })
  dob: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'validation.NOT_EMPTY' })
  countryId: string;
}
