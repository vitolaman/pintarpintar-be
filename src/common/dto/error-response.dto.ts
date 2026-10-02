import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: { order_id: '10000000-0000-4000-8000-000000000001' },
    description:
      'Machine-readable context of some errors, for example the pending order of an "awaiting payment" conflict',
  })
  details?: Record<string, unknown> | null;
}
