import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MasterProfilePicture } from './entities/master-pfp.entity';
import { Repository } from 'typeorm';
import { FindAllMasterPfpResDto } from './dto/get-master-pfp.dto';

@Injectable()
export class MasterPfpService {
  constructor(
    @InjectRepository(MasterProfilePicture)
    private masterPfpRepo: Repository<MasterProfilePicture>,
  ) {}

  async findAll(prefixLink: string): Promise<FindAllMasterPfpResDto> {
    const pfp = await this.masterPfpRepo.find({
      order: {
        created_at: 'ASC',
      },
    });

    const updatedPfp = pfp.map((item) => {
      return {
        ...item,
        imagePath: prefixLink + item.imagePath,
      };
    });

    return new FindAllMasterPfpResDto({
      data: updatedPfp,
      responseMessage: 'Get All Master Profile Picture',
    });
  }
}
