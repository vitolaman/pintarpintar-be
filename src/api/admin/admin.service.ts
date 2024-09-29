import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOneOptions, Repository } from 'typeorm';
import { compareSync } from 'bcryptjs';

import { JwtService } from '@nestjs/jwt';
import { AdminSignInBodyDto, AdminSignInResDto } from './dto/admin-sign-in.dto';
import { Admin } from './entities/admin.entity';
import { AdminFindOneUserResDto } from './dto/admin-find-one-user.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(Admin)
    private adminRepo: Repository<Admin>,
    private jwtService: JwtService,
  ) {}

  async generateJwt(admin: Admin): Promise<string> {
    const adminData = await this.adminRepo.findOne({ where: { id: admin.id } });
    await this.adminRepo.save(adminData);

    return this.jwtService.sign({
      id: admin.id,
    });
  }

  async findOne(
    options: FindOneOptions<Admin>,
  ): Promise<AdminFindOneUserResDto> {
    const data = await this.adminRepo.findOne(options);

    if (!data) throw new NotFoundException();

    return new AdminFindOneUserResDto({ data });
  }

  async signIn(body: AdminSignInBodyDto): Promise<AdminSignInResDto> {
    const { email } = body;
    const admin = await this.adminRepo.findOne({
      where: { email },
    });

    if (!admin) throw new ForbiddenException('invalid username or password');

    if (!admin.password)
      throw new BadRequestException(
        'you might have sign-up using SSO, please sign-in accordingly',
      );

    if (!compareSync(body.password, admin.password))
      throw new ForbiddenException('invalid username or password');

    const token = await this.generateJwt(admin);

    return new AdminSignInResDto({
      responseMessage: 'Login Success',
      data: { token },
    });
  }
}
