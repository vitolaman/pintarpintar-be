import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Order, OrderStatus } from '~/api/order/entities/order.entity';
import { OrderFulfillmentService } from './order-fulfillment.service';
import { GatewayResult, OrderPaymentService } from './order-payment.service';

const result = (override: Partial<GatewayResult> = {}): GatewayResult => ({
  orderNumber: 'ORD-20260930-0001',
  resultCode: '00',
  amount: '150000',
  reference: 'DS123',
  paymentMethod: 'BC',
  settlementDate: '2026-10-02',
  ...override,
});

describe('OrderPaymentService.applyGatewayResult', () => {
  const execute = jest.fn();
  const builder = {
    update: () => builder,
    set: () => builder,
    where: () => builder,
    insert: () => builder,
    into: () => builder,
    values: () => builder,
    orIgnore: () => builder,
    execute,
  };
  const manager = {
    findOne: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    query: jest.fn(),
    createQueryBuilder: () => builder,
  };
  const fulfil = jest.fn();
  const service = new OrderPaymentService(
    {
      transaction: (work: (m: typeof manager) => unknown) => work(manager),
    } as unknown as DataSource,
    { fulfil } as unknown as OrderFulfillmentService,
  );
  const order = (override: Partial<Order> = {}) =>
    ({
      id: 'order-id',
      userId: 'user-id',
      orderNumber: 'ORD-20260930-0001',
      totalAmount: '150000',
      status: OrderStatus.PENDING,
      couponId: 'coupon-id',
      discountCodeId: null,
      paymentGatewayRef: 'DS123',
      ...override,
    }) as Order;

  beforeEach(() => {
    jest.clearAllMocks();
    manager.query.mockResolvedValue([{ max_uses: null, used: 0 }]);
  });

  it('rejects an unknown order', async () => {
    manager.findOne.mockResolvedValueOnce(null);
    await expect(service.applyGatewayResult(result())).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects an amount that differs from the order', async () => {
    manager.findOne.mockResolvedValueOnce(order());
    await expect(
      service.applyGatewayResult(result({ amount: '149999' })),
    ).rejects.toThrow(BadRequestException);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('leaves a paid order unchanged on a repeated notification', async () => {
    manager.findOne.mockResolvedValueOnce(order({ status: OrderStatus.PAID }));
    await expect(service.applyGatewayResult(result())).resolves.toBe(
      'unchanged',
    );
    expect(manager.update).not.toHaveBeenCalled();
    expect(fulfil).not.toHaveBeenCalled();
  });

  it('marks a pending order paid with the reported details and fulfils it', async () => {
    manager.findOne.mockResolvedValueOnce(order());
    await expect(service.applyGatewayResult(result())).resolves.toBe('paid');
    expect(manager.update).toHaveBeenCalledWith(
      Order,
      { id: 'order-id' },
      expect.objectContaining({
        status: OrderStatus.PAID,
        paymentMethod: 'BC',
        paymentGatewayRef: 'DS123',
        settlementDate: '2026-10-02',
      }),
    );
    expect(fulfil).toHaveBeenCalledTimes(1);
    expect(manager.softDelete).not.toHaveBeenCalled();
  });

  it('falls back to H+4 when no settlement date is reported', async () => {
    manager.findOne.mockResolvedValueOnce(order());
    manager.query.mockResolvedValueOnce([{ date: '2026-10-04' }]);
    await service.applyGatewayResult(result({ settlementDate: 'soon' }));
    expect(manager.query.mock.calls[0][1]).toEqual([4]);
    expect(manager.update.mock.calls[0][2].settlementDate).toBe('2026-10-04');
  });

  it('pays an expired order and restores its voucher usage', async () => {
    manager.findOne.mockResolvedValueOnce(
      order({ status: OrderStatus.EXPIRED }),
    );
    await expect(service.applyGatewayResult(result())).resolves.toBe('paid');
    expect(execute).toHaveBeenCalled();
    expect(fulfil).toHaveBeenCalledTimes(1);
  });

  it('fails a pending order on another result code and releases its codes', async () => {
    manager.findOne.mockResolvedValueOnce(order());
    await expect(
      service.applyGatewayResult(result({ resultCode: '01' })),
    ).resolves.toBe('failed');
    expect(manager.update).toHaveBeenCalledWith(
      Order,
      { id: 'order-id' },
      { status: OrderStatus.FAILED },
    );
    expect(manager.softDelete).toHaveBeenCalled();
    expect(fulfil).not.toHaveBeenCalled();
  });

  it('ignores a failure for an order that is no longer pending', async () => {
    manager.findOne.mockResolvedValueOnce(
      order({ status: OrderStatus.CANCELLED }),
    );
    await expect(
      service.applyGatewayResult(result({ resultCode: '02' })),
    ).resolves.toBe('unchanged');
    expect(manager.update).not.toHaveBeenCalled();
  });
});
