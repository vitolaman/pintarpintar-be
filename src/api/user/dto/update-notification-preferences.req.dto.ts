import { ApiProperty } from '@nestjs/swagger';

export class UpdateNotificationPreferencesDto {
  @ApiProperty()
  email_notification: boolean;

  @ApiProperty()
  app_notification: boolean;
}
