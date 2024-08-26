import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class CreatePredictionDto {
  @IsNotEmpty()
  @IsString()
  @IsIn(['soccernew', 'bsktbl', 'tennis_scores', 'cricket'])
  @ApiProperty({
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
  @IsIn(['1', '2', '3'])
  @ApiProperty({
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
