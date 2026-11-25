import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  PRO_CODE_NOT_APPLICABLE,
  ProSubscribeRequestDto,
} from './pro-subscribe.dto';

// The application's validation pipe (src/main.ts).
const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});
const planId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

const subscribeBody = (body: unknown) =>
  pipe.transform(body, {
    type: 'body',
    metatype: ProSubscribeRequestDto,
  }) as Promise<ProSubscribeRequestDto>;
const rejection = async (work: Promise<unknown>) => {
  const error = await work.catch((e) => e);
  expect(error).toBeInstanceOf(BadRequestException);
  return (error as BadRequestException).getResponse() as {
    message: string[];
  };
};

describe('ProSubscribeRequestDto', () => {
  it('accepts a plan without a code', async () => {
    const body = await subscribeBody({ plan_id: planId });
    expect(body).toEqual({ plan_id: planId });
  });

  it.each([null, '', '   '])(
    'treats code %j as no code entered',
    async (empty) => {
      const body = await subscribeBody({ plan_id: planId, code: empty });
      expect(body.plan_id).toBe(planId);
      expect(body.code).toBeUndefined();
    },
  );

  it.each(['PROMO10', ' promo10 ', 0, 10, true, ['PROMO10'], {}])(
    'refuses code %j with a clear message',
    async (code) => {
      const response = await rejection(
        subscribeBody({ plan_id: planId, code }),
      );
      expect(response.message).toEqual([PRO_CODE_NOT_APPLICABLE]);
    },
  );

  it('still validates the plan id next to a code', async () => {
    const response = await rejection(
      subscribeBody({ plan_id: 'not-a-uuid', code: 'PROMO10' }),
    );
    expect(response.message).toEqual(
      expect.arrayContaining([
        PRO_CODE_NOT_APPLICABLE,
        'plan_id must be a UUID',
      ]),
    );
  });
});
