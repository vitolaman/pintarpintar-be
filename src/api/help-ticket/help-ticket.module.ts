import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { HelpTicketController } from './help-ticket.controller';
import { HelpTicketService } from './help-ticket.service';
import { HelpTicket } from './entities/help-ticket.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([HelpTicket, User]),
    // Limits are set per route with @Throttle; no guard applies globally.
    ThrottlerModule.forRoot([{ ttl: 600_000, limit: 5 }]),
  ],
  controllers: [HelpTicketController],
  providers: [HelpTicketService],
})
export class HelpTicketModule {}
