import jwtConfig from './jwt.config';

describe('jwt config', () => {
  const original = process.env.JWT_ADMIN_KEY;

  afterEach(() => {
    process.env.JWT_ADMIN_KEY = original;
  });

  it.each([undefined, '', '   '])('refuses a missing secret (%j)', (value) => {
    if (value === undefined) delete process.env.JWT_ADMIN_KEY;
    else process.env.JWT_ADMIN_KEY = value;
    expect(() => jwtConfig()).toThrow('JWT_ADMIN_KEY must be set');
  });

  it('uses the configured secret', () => {
    process.env.JWT_ADMIN_KEY = 'configured-secret';
    expect(jwtConfig()).toMatchObject({ secret: 'configured-secret' });
  });
});
