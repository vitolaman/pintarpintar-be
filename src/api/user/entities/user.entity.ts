import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'users' })
export class User extends BaseEntity {
  @ApiProperty()
  @Column({ nullable: true })
  name: string;

  @ApiProperty()
  @Column({ nullable: true })
  username: string;

  @ApiProperty()
  @Column({ nullable: false })
  email: string;

  @ApiProperty()
  @Column({ nullable: true })
  phone: string;

  @ApiHideProperty()
  @Exclude()
  @Column({ nullable: false })
  password: string;

  @ApiProperty()
  @Column({ name: 'profile_pic_path', nullable: true })
  profilePicPath: string;

  @ApiProperty()
  @Column({ name: 'referral_code', nullable: true })
  referralCode: string;

  @ApiProperty({ format: 'YYYY-MM-DD', example: '1990-01-01' })
  @Column({ type: 'date', nullable: true })
  dob: Date;

  @ApiProperty()
  @Column({ name: 'wallet_address', type: 'text', nullable: true })
  walletAddress: string;

  @ApiProperty()
  @Column({ name: 'country_id', nullable: true })
  countryId: number;

  @ApiProperty()
  @Column({ name: 'discord_auth_token', nullable: true })
  discordToken: string;

  @ApiProperty()
  @Column({ name: 'twitter_auth_token', nullable: true })
  twitterToken: string;
}
