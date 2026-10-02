import { ClassStatus } from '../entities/class.entity';
import { ClassKind, classKinds } from '../../common/catalog/item-kind';
import { EnumInput } from '~/common/decorator/input.decorator';
import { LimitQuery, PageQuery } from '~/common/dto/request-paginated.dto';

export class ClassListQueryDto {
  @PageQuery()
  page?: number = 1;

  @LimitQuery()
  limit?: number = 10;

  @EnumInput(Object.values(ClassStatus), { presence: 'filter' })
  status?: ClassStatus;

  @EnumInput(classKinds, { presence: 'filter' })
  type?: ClassKind;
}
