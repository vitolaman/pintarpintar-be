import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum SocialTypeEnum {
  DISCORD = 'discord',
  TWITTER = 'twitter',
}

export class UpdateSocialTokenDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: '********' })
  token: string;

  @IsNotEmpty()
  @IsEnum(SocialTypeEnum)
  @ApiProperty({ enum: SocialTypeEnum, example: 'discord | twitter' })
  type: SocialTypeEnum;
}
