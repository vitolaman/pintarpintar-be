import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

export enum HelpTicketType {
  KRITIK = 'kritik',
  PUJIAN = 'pujian',
  SARAN = 'saran',
}

@Entity({ name: 'help_tickets' })
export class HelpTicket extends BaseEntity {
  // Null for anonymous feedback from the public help page.
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({
    name: 'ticket_type',
    type: 'enum',
    enum: HelpTicketType,
    enumName: 'help_ticket_type_enum',
  })
  ticketType: HelpTicketType;

  @Column({ type: 'text' })
  message: string;
}
