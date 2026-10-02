import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({
    example: 'BAD_REQUEST',
    description: 'The HTTP status name, for example NOT_FOUND',
  })
  error: string;

  @ApiProperty({
    type: [String],
    example: ['limit must be an integer number'],
    description: 'Human-readable reasons; one entry per validation failure',
  })
  responseMessage: string[];
}
