import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DuitkuCallbackDto } from './dto/duitku-callback.dto';
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
  const callback = (override: Partial<DuitkuCallbackDto> = {}) =>
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
    }) as DuitkuCallbackDto;

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

  it('reports an unknown order as a bad request', async () => {
    applyGatewayResult.mockRejectedValueOnce(new NotFoundException());

    await expect(controller.handleDuitkuCallback(callback())).rejects.toThrow(
      new BadRequestException('Unknown order'),
    );
  });
});
