import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthSessionController } from './auth-session.controller';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  controllers: [AuthController, AuthSessionController],
  providers: [AuthService, PasswordResetService],
  exports: [AuthService, JwtModule],
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: configService.get<string>('jwt.expiresIn'),
        },
      }),
    }),
    TypeOrmModule.forFeature([User]),
    UserModule,
  ],
})
export class AuthModule {}
