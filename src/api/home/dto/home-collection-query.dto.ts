import { LimitQuery } from '~/common/dto/request-paginated.dto';

export class HomeCollectionQueryDto {
  @LimitQuery({
    maxLimit: 50,
    description: 'Maximum number of items to return.',
  })
  limit = 10;
}
