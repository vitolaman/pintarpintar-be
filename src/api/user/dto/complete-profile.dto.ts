import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import * as moment from 'moment';

export class CompleteProfileDto {
  @ApiProperty({ example: 'Silver Stripe' })
  @IsString()
  @IsNotEmpty({ message: 'validation.NOT_EMPTY' })
  name: string;

  @ApiProperty({ example: '0812412751' })
  @IsString()
  @IsNotEmpty({ message: 'validation.NOT_EMPTY' })
  phone: string;

  @ApiProperty({ example: '1920-10-25' })
  @IsNotEmpty({ message: 'validation.NOT_EMPTY' })
  @Transform(({ value }) => {
    const isValid = moment(value, 'YYYY-MM-DD', true).isValid();
    if (!isValid) {
      throw new Error('Date of birth must be in the format YYYY-MM-DD');
    }
    return value;
  })
  dob: string;

  @ApiProperty({ example: '1' })
  @IsString()
  @IsNotEmpty({ message: 'validation.NOT_EMPTY' })
  countryId: string;
}
