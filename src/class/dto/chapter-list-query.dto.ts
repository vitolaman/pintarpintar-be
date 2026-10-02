import { LimitQuery, PageQuery } from '../../common/dto/request-paginated.dto';

// The editor reorders every chapter at once, so the list is complete unless
// the client asks for pages.
export class ChapterListQueryDto {
  @PageQuery()
  page?: number = 1;

  @LimitQuery({
    defaultLimit: undefined,
    description: 'Items per page; omit to receive every chapter.',
  })
  limit?: number;
}
