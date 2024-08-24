import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import * as moment from 'moment';

export class UpdateProfileDto {
  @ApiProperty()
  @IsString()
  @IsOptional()
  name: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  phone: string;

  @ApiProperty()
  @IsOptional()
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
  @IsOptional()
  countryId: string;
}
