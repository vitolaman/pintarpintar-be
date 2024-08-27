import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum SportEnum {
  SOCCER = 'soccernew',
  BASKETBALL = 'bsktbl',
  TENNIS = 'tennis_scores',
  CRICKET = 'cricket',
}

export enum PredictionEnum {
  LOCAL_TEAM_WIN = '1',
  VISITOR_TEAM_WIN = '2',
  DRAW = '3',
}

export class CreatePredictionDto {
  @IsNotEmpty()
  @IsString()
  @IsEnum(SportEnum)
  @ApiProperty({
    enum: SportEnum,
    example: 'soccernew | bsktbl | tennis_scores | cricket',
  })
  sport: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: '1' })
  categoryId: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: '1' })
  matchId: string;

  @IsNotEmpty()
  @IsString()
  @IsEnum(PredictionEnum)
  @ApiProperty({
    enum: PredictionEnum,
    example: '1 | 2 | 3',
    description: '1: local team win; 2: visitor team win; 3: draw.',
  })
  prediction: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: '1' })
  localTeamId: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: '1' })
  visitorTeamId: string;
}
