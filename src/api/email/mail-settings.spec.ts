import { ConfigService } from '@nestjs/config';
import { DEFAULT_FRONTEND_URL, MailSettings } from './mail-settings';

const settings = (values: Record<string, string | undefined>) =>
  new MailSettings({
    get: (name: string) => values[name],
  } as unknown as ConfigService);

const COMPLETE = {
  MAIL_HOST: 'mail.example.test',
  MAIL_PORT: '587',
  MAIL_USERNAME: 'mail@example.test',
  MAIL_PASSWORD: 'secret',
  MAIL_SENDER: 'Pintar Pintar <info@example.test>',
  FRONTEND_URL: 'https://pintarpintar.id/',
};

describe('MailSettings', () => {
  it('is complete when every variable is set', () => {
    const mail = settings(COMPLETE);
    expect(mail.missing()).toEqual([]);
    expect(mail.frontendUrl).toBe('https://pintarpintar.id');
  });

  it('names missing, blank and invalid variables, never values', () => {
    expect(
      settings({
        ...COMPLETE,
        MAIL_HOST: ' ',
        MAIL_PASSWORD: undefined,
      }).missing(),
    ).toEqual(['MAIL_HOST', 'MAIL_PASSWORD']);
    expect(settings({ ...COMPLETE, MAIL_PORT: 'smtp' }).missing()).toEqual([
      'MAIL_PORT',
    ]);
  });

  it('does not require FRONTEND_URL and defaults it to pintarpintar.id', () => {
    const mail = settings({ ...COMPLETE, FRONTEND_URL: undefined });
    expect(mail.missing()).toEqual([]);
    expect(mail.frontendUrl).toBe('https://pintarpintar.id');
    expect(DEFAULT_FRONTEND_URL).toBe('https://pintarpintar.id');
    expect(settings({ ...COMPLETE, FRONTEND_URL: '  ' }).frontendUrl).toBe(
      'https://pintarpintar.id',
    );
  });

  it('lets FRONTEND_URL override the default', () => {
    expect(
      settings({
        ...COMPLETE,
        FRONTEND_URL: 'https://staging.pintarpintar.id//',
      }).frontendUrl,
    ).toBe('https://staging.pintarpintar.id');
    expect(
      settings({ ...COMPLETE, FRONTEND_URL: 'http://localhost:3000' })
        .frontendUrl,
    ).toBe('http://localhost:3000');
  });

  it('uses the default, warning once, when FRONTEND_URL is unusable', () => {
    const mail = settings({ ...COMPLETE, FRONTEND_URL: 'typo-frontend-value' });
    const warn = jest
      .spyOn(mail['logger'], 'warn')
      .mockImplementation(() => undefined);

    expect(mail.frontendUrl).toBe('https://pintarpintar.id');
    expect(mail.frontendUrl).toBe('https://pintarpintar.id');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('FRONTEND_URL');
    expect(warn.mock.calls[0][0]).not.toContain('typo-frontend-value');
  });

  it('defaults API_PUBLIC_URL to the live API and lets it be overridden', () => {
    expect(settings(COMPLETE).apiPublicUrl).toBe('https://api.pintarpintar.id');
    expect(
      settings({ ...COMPLETE, API_PUBLIC_URL: 'http://localhost:3001/' })
        .apiPublicUrl,
    ).toBe('http://localhost:3001');
  });

  it('warns once per unusable URL variable, by name', () => {
    const mail = settings({
      ...COMPLETE,
      FRONTEND_URL: 'typo-frontend-value',
      API_PUBLIC_URL: 'typo-api-value',
    });
    const warn = jest
      .spyOn(mail['logger'], 'warn')
      .mockImplementation(() => undefined);

    expect(mail.apiPublicUrl).toBe('https://api.pintarpintar.id');
    expect(mail.apiPublicUrl).toBe('https://api.pintarpintar.id');
    expect(mail.frontendUrl).toBe('https://pintarpintar.id');
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0][0]).toContain('API_PUBLIC_URL');
    expect(warn.mock.calls[0][0]).not.toContain('typo-api-value');
  });

  it('uses STARTTLS on 587 and implicit TLS on 465', () => {
    expect(settings(COMPLETE).smtpTransport()).toMatchObject({
      host: 'mail.example.test',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: 'mail@example.test', pass: 'secret' },
    });
    expect(
      settings({ ...COMPLETE, MAIL_PORT: '465' }).smtpTransport(),
    ).toMatchObject({ port: 465, secure: true, requireTLS: false });
  });
});
