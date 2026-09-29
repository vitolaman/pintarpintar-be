import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, Length } from 'class-validator';
import { HelpTicketType } from '../entities/help-ticket.entity';

export class CreateHelpTicketDto {
  @ApiProperty({ enum: HelpTicketType, example: HelpTicketType.KRITIK })
  @IsEnum(HelpTicketType)
  ticket_type: HelpTicketType;

  @ApiProperty({ example: 'Aplikasi sering error saat submit form.' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 2000)
  message: string;
}
