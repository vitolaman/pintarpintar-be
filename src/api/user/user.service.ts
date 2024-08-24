import {
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOneOptions, FindOptionsWhere, ILike, Repository } from 'typeorm';
import { RequestPaginatedQueryWithSearchDto } from '~/common/dto/request-paginated.dto';
import { FindAllUserResDto } from './dto/find-all-user.res.dto';
import { FindOneUserResDto } from './dto/find-one-user.res.dto';
import { hashSync } from 'bcrypt';
import { Response } from 'express';
import { User } from './entities/user.entity';
import { CreateUserBodyDto } from './dto/create-user.req.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { v4 as uuidv4 } from 'uuid';
import { Referrals } from './entities/referrals.entity';
import { UpdateProfileResDto } from './dto/update-profile.res.dto';
import { UpdateProfileDto } from './dto/update-profile.req.dto';
import {
  SocialTypeEnum,
  UpdateSocialTokenDto,
} from './dto/update-social-token.req.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Referrals)
    private refRepo: Repository<Referrals>,
  ) {}

  async findOne(options: FindOneOptions<User>): Promise<FindOneUserResDto> {
    const data = await this.userRepo.findOne(options);

    if (!data) throw new NotFoundException();

    return new FindOneUserResDto({ data });
  }

  async findMe(id: string): Promise<FindOneUserResDto> {
    const user = await this.userRepo.findOne({ where: { id } });

    return new FindOneUserResDto({
      data: user,
    });
  }

  async findById(id: string): Promise<FindOneUserResDto> {
    const { data: user } = await this.findMe(id);

    return new FindOneUserResDto({
      data: user,
    });
  }

  private async generateUniqueReferralCode(): Promise<string> {
    let referralCode;
    let isUnique = false;

    while (!isUnique) {
      referralCode = uuidv4().split('-')[0];
      const existingUser = await this.userRepo.findOne({
        where: { referralCode },
      });
      if (!existingUser) {
        isUnique = true;
      }
    }

    return referralCode;
  }

  async create(body: CreateUserBodyDto, res: Response) {
    const { email, password, username, referralCode: userReferralCode } = body;

    const queryRunner = this.userRepo.manager.connection.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (!email && !password && !username) {
        await queryRunner.rollbackTransaction();
        return res.status(HttpStatus.BAD_REQUEST).json({
          responseMessage: `Email, password, and username cannot be empty!`,
        });
      }

      let exists = await this.userRepo.findOne({
        where: { email },
      });

      if (exists) {
        await queryRunner.rollbackTransaction();
        return res.status(HttpStatus.CONFLICT).json({
          responseMessage: `Email already registered!`,
        });
      }

      exists = await this.userRepo.findOne({
        where: { username },
      });

      if (exists) {
        await queryRunner.rollbackTransaction();
        return res.status(HttpStatus.CONFLICT).json({
          responseMessage: `Username already registered!`,
        });
      }

      let checkReffExist: User;
      if (userReferralCode) {
        checkReffExist = await this.userRepo.findOne({
          where: { referralCode: userReferralCode },
        });

        if (!checkReffExist)
          return res.status(HttpStatus.NOT_FOUND).json({
            responseMessage: `Referral Code Not Found!`,
          });
      }

      body.password = hashSync(body.password, 10);
      body.referralCode = await this.generateUniqueReferralCode();

      const data = await queryRunner.manager.save(this.userRepo.create(body));

      if (userReferralCode) {
        await queryRunner.manager.increment(
          User,
          { id: checkReffExist.id },
          'countReferrals',
          1,
        );

        await queryRunner.manager.save(
          this.refRepo.create({
            userIdRefOwner: checkReffExist.id,
            userIdRefUser: data.id,
          }),
        );
      }

      await queryRunner.commitTransaction();

      return res.status(HttpStatus.OK).json({
        responseMessage: `Account Created!`,
      });
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException();
    } finally {
      await queryRunner.release();
    }
  }

  // async update(
  //   id: string,
  //   body: UpdateUserBodyDto,
  // ): Promise<FindOneUserResDto> {
  //   if (body.old_password) {
  //     const { data: user } = await this.findOne({ where: { id } });

  //     if (!compareSync(body.old_password, user.password))
  //       throw new BadRequestException('current password was invalid');

  //     delete body.old_password;
  //   }

  //   if (body.password) body.password = hashSync(body.password, 10);

  //   const { tag, email, phone } = body;
  //   if (tag || email || phone) {
  //     const where = [];
  //     if (tag) where.push({ id: Not(id), tag });
  //     if (email) where.push({ id: Not(id), email });
  //     if (phone) where.push({ id: Not(id), phone });
  //     const exists = await this.userRepo.findOne({ where });

  //     if (exists)
  //       throw new ForbiddenException([
  //         'tag, email or phone has been registered',
  //       ]);
  //   }

  //   await this.userRepo.save(this.userRepo.create({ ...body, id }));

  //   return this.findOne({ where: { id } });
  // }

  async delete(id: string): Promise<void> {
    await this.userRepo.softDelete({ id });
  }

  async findAllUsers({
    limit,
    page,
    search,
  }: RequestPaginatedQueryWithSearchDto): Promise<FindAllUserResDto> {
    const where: FindOptionsWhere<User>[] = [];
    if (search) {
      where.push({ name: ILike(`%${search}%`) });
      where.push({ username: ILike(`%${search}%`) });
    }
    const users = await this.userRepo.find({
      where: where.length > 0 ? where : undefined,
      order: {
        name: 'ASC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    for (const user of users) {
      delete user.password;
    }

    return new FindAllUserResDto({
      data: users,
    });
  }

  async completeProfile(
    body: CompleteProfileDto,
    picture: any,
    userId: string,
    res: Response,
  ) {
    const user = await this.userRepo.findOneBy({ id: userId });

    if (!user) {
      return res.status(HttpStatus.NOT_FOUND).json({
        responseMessage: `User not found`,
      });
    }

    if (picture) {
      body['profilePicPath'] = picture.path;
    }

    Object.assign(user, body);

    await this.userRepo.save(user);

    return res.status(HttpStatus.OK).json({
      responseMessage: `Complete Profile Success!`,
    });
  }

  async editProfile(
    body: UpdateProfileDto,
    picture: any,
    userId: string,
  ): Promise<UpdateProfileResDto> {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (picture) {
      body['profilePicPath'] = picture.path;
    }

    Object.assign(user, body);

    const updatedUser = await this.userRepo.save(user);

    delete updatedUser.password;

    return new UpdateProfileResDto({
      data: updatedUser,
      responseMessage: 'Update profile success',
    });
  }

  async updateSocialToken(
    body: UpdateSocialTokenDto,
    userId: string,
  ): Promise<UpdateProfileResDto> {
    const { type, token } = body;
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (type === SocialTypeEnum.TWITTER) {
      user.twitterToken = token;
    } else {
      user.discordToken = token;
    }

    const updatedUser = await this.userRepo.save(user);

    delete updatedUser.password;

    return new UpdateProfileResDto({
      data: updatedUser,
      responseMessage: 'Update social token success',
    });
  }
}
