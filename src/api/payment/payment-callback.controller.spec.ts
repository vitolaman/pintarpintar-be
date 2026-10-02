import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DuitkuClient } from './duitku/duitku.client';
import { OrderPaymentService } from './order-payment.service';
import { PaymentCallbackController } from './payment-callback.controller';

// HMAC-SHA256('DMOCK1' + '150000' + 'ORD-20260930-0001', 'secret-key').
const SIGNATURE =
  '0cef7caae789e3416f1612ee5bcb5fabb8e54701e201f152a1dc62e048d7c8bd';

describe('PaymentCallbackController', () => {
  const applyGatewayResult = jest.fn();
  const controller = new PaymentCallbackController(
    {
      requireConfig: () => ({ merchantCode: 'DMOCK1', apiKey: 'secret-key' }),
    } as unknown as DuitkuClient,
    { applyGatewayResult } as unknown as OrderPaymentService,
  );
  const callback = (override: Record<string, unknown> = {}) =>
    ({
      merchantCode: 'DMOCK1',
      amount: '150000',
      merchantOrderId: 'ORD-20260930-0001',
      resultCode: '00',
      signature: SIGNATURE,
      reference: 'DS123',
      paymentCode: 'BC',
      settlementDate: '2026-10-02',
      ...override,
    }) as Record<string, unknown>;

  beforeEach(() => applyGatewayResult.mockReset());

  it('applies a verified notification', async () => {
    await expect(controller.handleDuitkuCallback(callback())).resolves.toEqual({
      responseMessage: 'Callback processed',
    });
    expect(applyGatewayResult).toHaveBeenCalledWith({
      orderNumber: 'ORD-20260930-0001',
      resultCode: '00',
      amount: '150000',
      reference: 'DS123',
      paymentMethod: 'BC',
      settlementDate: '2026-10-02',
    });
  });

  it.each([
    ['a wrong signature', { signature: 'f'.repeat(64) }],
    ['another merchant code', { merchantCode: 'DOTHER' }],
    ['an altered amount', { amount: '1' }],
  ])('rejects %s without applying it', async (_case, override) => {
    await expect(
      controller.handleDuitkuCallback(callback(override)),
    ).rejects.toThrow(BadRequestException);
    expect(applyGatewayResult).not.toHaveBeenCalled();
  });

  it('accepts the fields Duitku sends that this API does not use', async () => {
    await expect(
      controller.handleDuitkuCallback(
        callback({
          productDetail: 'Pembayaran ORD-20260930-0001',
          additionalParam: '',
          merchantUserId: 'buyer@example.com',
          publisherOrderId: 'PUB123',
          spUserHash: 'hash',
          issuerCode: '93600014',
        }),
      ),
    ).resolves.toEqual({ responseMessage: 'Callback processed' });
    expect(applyGatewayResult).toHaveBeenCalledTimes(1);
  });

  it('still validates the fields it uses', async () => {
    await expect(
      controller.handleDuitkuCallback(callback({ signature: undefined })),
    ).rejects.toThrow(BadRequestException);
    expect(applyGatewayResult).not.toHaveBeenCalled();
  });

  it('reports an unknown order as a bad request', async () => {
    applyGatewayResult.mockRejectedValueOnce(new NotFoundException());

    await expect(controller.handleDuitkuCallback(callback())).rejects.toThrow(
      new BadRequestException('Unknown order'),
    );
  });
});
