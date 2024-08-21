import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { JwtModuleOptions, JwtOptionsFactory } from '@nestjs/jwt';
import jwtConfig from '~/config/jwt.config';

@Injectable()
export class JwtOption implements JwtOptionsFactory {
  constructor(
    @Inject(jwtConfig.KEY)
    private jwtCfg: ConfigType<typeof jwtConfig>,
  ) {}

  createJwtOptions(): JwtModuleOptions | Promise<JwtModuleOptions> {
    return {
      secret: 'secret',
      signOptions: { expiresIn: '30d' },
    };
  }
}
