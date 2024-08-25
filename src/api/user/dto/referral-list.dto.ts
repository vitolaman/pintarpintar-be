import { ResponsePaginatedDto } from '~/common/dto/response-paginated.dto-default';

export interface IReferralListRes {
  reffId: string;
  username: string;
  createdAt: string;
}

export class ReferralListResDto extends ResponsePaginatedDto<IReferralListRes> {}
