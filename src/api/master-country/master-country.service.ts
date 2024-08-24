import { Injectable } from '@nestjs/common';
import {
  FindAllMasterCountryResDto,
  GetMasterCountryDto,
} from './dto/get-master-country.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { MasterCountry } from './entities/master-country.entity';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';

@Injectable()
export class MasterCountryService {
  constructor(
    @InjectRepository(MasterCountry)
    private masterCountryRepo: Repository<MasterCountry>,
  ) {}
  async findAll(req: GetMasterCountryDto): Promise<FindAllMasterCountryResDto> {
    const body = { ...req };

    const where: FindOptionsWhere<MasterCountry>[] = [];
    if (body.keyword) {
      where.push({ countryName: ILike(`%${body.keyword}%`) });
    }
    const countries = await this.masterCountryRepo.find({
      where: where.length > 0 ? where : undefined,
      order: {
        countryName: 'ASC',
      },
    });

    return new FindAllMasterCountryResDto({
      data: countries,
      responseMessage: 'Get country list success',
    });
  }
}
