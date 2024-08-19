import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile } from 'passport';
import {
  GoogleCallbackParameters,
  Strategy,
  VerifyCallback,
} from 'passport-google-oauth20';
import AUTH_CONFIG from '~/config/auth.config';

@Injectable()
export class GoogleAuthStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    @Inject(AUTH_CONFIG.KEY)
    private authConfig: ConfigType<typeof AUTH_CONFIG>,
  ) {
    const {
      clientId: clientID,
      clientSecret,
      callbackUrl: callbackURL,
    } = authConfig.google;

    super(
      {
        clientID,
        clientSecret,
        callbackURL,
        scope: ['email', 'profile', 'openid'],
      },
      async (
        accessToken: string,
        refreshToken: string,
        params: GoogleCallbackParameters,
        profile: Profile,
        done: VerifyCallback,
      ) => {
        const { id_token: idToken } = params;
        const {
          displayName: name,
          emails: [{ value: email }],
          photos: [{ value: avatar }],
          id,
        } = profile;
        done(null, {
          id,
          name,
          email,
          avatar,
          accessToken,
          refreshToken,
          idToken,
        });
      },
    );
  }
}
