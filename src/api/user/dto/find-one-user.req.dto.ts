import { IsUUID } from 'class-validator';

export class FindOneUserParamDto {
  @IsUUID()
  id: string;
}
