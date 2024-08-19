import { MailerOptions } from '@nestjs-modules/mailer';
import { registerAs } from '@nestjs/config';

export default registerAs(
  'mail',
  () =>
    <MailerOptions>{
      transport: {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.MAIL_USERNAME,
          pass: process.env.MAIL_PASSWORD,
        },
      },
      defaults: {
        from: process.env.MAIL_SENDER,
      },
    },
);
