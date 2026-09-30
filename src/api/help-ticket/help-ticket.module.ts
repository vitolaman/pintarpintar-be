import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { HelpTicketController } from './help-ticket.controller';
import { HelpTicketService } from './help-ticket.service';
import { HelpTicket } from './entities/help-ticket.entity';

@Module({
  imports: [TypeOrmModule.forFeature([HelpTicket, User])],
  controllers: [HelpTicketController],
  providers: [HelpTicketService],
})
export class HelpTicketModule {}
