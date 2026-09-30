import { ApiProperty } from '@nestjs/swagger';
import { HelpTicketType } from '../entities/help-ticket.entity';

export class HelpTicketResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description: 'Null for anonymous feedback',
  })
  user_id: string | null;

  @ApiProperty({ nullable: true })
  user_name: string | null;

  @ApiProperty({ enum: HelpTicketType, example: HelpTicketType.KRITIK })
  ticket_type: HelpTicketType;

  @ApiProperty()
  message: string;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}
