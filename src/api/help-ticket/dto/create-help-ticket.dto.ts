import { EnumInput, RequiredText } from '~/common/decorator/input.decorator';
import { HelpTicketType } from '../entities/help-ticket.entity';

export class CreateHelpTicketDto {
  @EnumInput(Object.values(HelpTicketType), {
    example: HelpTicketType.KRITIK,
  })
  ticket_type: HelpTicketType;

  @RequiredText({
    max: 2000,
    example: 'Aplikasi sering error saat submit form.',
  })
  message: string;
}
