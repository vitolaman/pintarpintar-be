import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as moment from 'moment-timezone';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOneOptions, FindOptionsWhere, ILike, Repository } from 'typeorm';
import { RequestPaginatedQueryWithSearchDto } from '~/common/dto/request-paginated.dto';
import { FindAllUserResDto } from './dto/find-all-user.res.dto';
import { FindOneUserResDto } from './dto/find-one-user.res.dto';
import { hashSync } from 'bcrypt';
import { Response } from 'express';
import { User } from './entities/user.entity';
import { CreateUserBodyDto } from './dto/create-user.req.dto';
import { redisConstant } from '~/constant/redis.constant';
import { RedisService } from '~/common/redis/src';
import { VerifyForgotPasswordOtpDto } from './dto/verify-forgot-password-otp.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private readonly redisService: RedisService,
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

  async create(body: CreateUserBodyDto): Promise<FindOneUserResDto> {
    const { email, password } = body;

    if (!email && !password)
      throw new ForbiddenException([
        'both email and password number cannot be empty',
      ]);

    const exists = await this.userRepo.findOne({
      where: { email },
    });

    if (exists)
      throw new ForbiddenException(['tag, email or phone has been registered']);

    body.password = hashSync(body.password, 10);

    const data = await this.userRepo.save(this.userRepo.create(body));

    return new FindOneUserResDto({ data });
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

  async findAllUssers({
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

    return new FindAllUserResDto({
      data: users,
    });
  }

  async forgotPassword(email: string, res: Response) {
    // Todo: send OTP to client email

    const redisKey = redisConstant.ACCESS_TOKEN_FORGOT_PASSWORD + email;

    const otp = this._generateOtp();
    const tokenData = {
      otp: otp,
      createdAt: moment.utc().format('YYYY-MM-DDTHH:mm:ssZ'),
      expiredAt: moment.utc().add(5, 'minutes').format('YYYY-MM-DDTHH:mm:ssZ'),
    };

    await this.redisService.saveCache(redisKey, tokenData, 300);

    return res.status(HttpStatus.OK).json({
      responseMessage: `OTP Berhasil Dikirimkan!`,
      otp: otp,
    });
  }

  private _generateOtp() {
    const otp = Math.floor(Math.random() * 10000);
    return otp.toString().padStart(4, '0');
  }

  async verifyForgotPasswordOtp(
    verifyForgotPasswordOtpDto: VerifyForgotPasswordOtpDto,
    res: Response,
  ) {
    const redisKey =
      redisConstant.ACCESS_TOKEN_FORGOT_PASSWORD +
      verifyForgotPasswordOtpDto.email;

    const redisData = await this.redisService.getCache(redisKey);

    if (redisData && redisData['otp'] === verifyForgotPasswordOtpDto.otp) {
      await this.redisService.removeCache(redisKey);

      return res.status(HttpStatus.OK).json({
        responseMessage: `Berhasil Verifikasi OTP!`,
      });
    }

    return res.status(HttpStatus.UNAUTHORIZED).json({
      responseMessage: `OTP Salah / Tidak Ditemukan!`,
    });
  }
}
