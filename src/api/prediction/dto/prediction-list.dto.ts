import { ResponsePaginatedDto } from '~/common/dto/response-paginated.dto-default';

export interface IPredictionListRes {
  predictionId: string;
  sport: string;
  categoryId: string;
  matchId: string;
  matchStatus: string;
  prediction: string;
  localTeamId: string;
  visitorTeamId: string;
  partnerDataJson: string;
  createdAt: string;
}

export class PredictionListResDto extends ResponsePaginatedDto<IPredictionListRes> {}
