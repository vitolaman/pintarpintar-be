import { ResponseDto } from '~/common/dto/response.dto-default';

export class GetUserNotificationPreferencesDataDto {
  email_notification: boolean;
  app_notification: boolean;
}

export class GetUserNotificationPreferencesDto extends ResponseDto<GetUserNotificationPreferencesDataDto> {}
