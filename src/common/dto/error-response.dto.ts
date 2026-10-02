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
    example: 'name should not be empty',
    description:
      'A human-readable message; the first reason of a validation failure',
  })
  responseMessage: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['name should not be empty', 'email must be an email'],
    description: 'Every reason of a validation failure',
  })
  errors?: string[];

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
