import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { DuitkuClient, InvoiceRequest } from './duitku.client';
import { requestSignature, statusSignature } from './duitku-signature';

jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  const post = jest.fn();
  return {
    __esModule: true,
    default: {
      ...actual,
      create: () => ({ post }),
      isAxiosError: actual.isAxiosError,
      post,
    },
  };
});

const post = (axios as unknown as { post: jest.Mock }).post;

const settings: Record<string, string> = {
  PAYMENT_GATEWAY_URL: 'https://api-sandbox.duitku.com/api/',
  PAYMENT_GATEWAY_STATUS_URL:
    'https://sandbox.duitku.com/webapi/api/merchant/transactionStatus',
  PAYMENT_GATEWAY_MERCHANT_KEY: 'DMOCK1',
  PAYMENT_GATEWAY_API_KEY: 'secret-key',
  PAYMENT_CALLBACK_URL: 'https://api.test/payments/v1/duitku-callback',
  PAYMENT_RETURN_URL: 'https://fe.test/payment?from=checkout',
};

const client = (overrides: Record<string, string | undefined> = {}) =>
  new DuitkuClient({
    get: (key: string) => ({ ...settings, ...overrides })[key],
  } as unknown as ConfigService);

const invoice: InvoiceRequest = {
  orderId: 'order-id',
  orderNumber: 'ORD-20260930-0001',
  amount: 150000,
  productDetails: 'Pintar Pintar ORD-20260930-0001: Kelas',
  email: 'budi@example.test',
  customerName: 'Budi Santoso Wijayakusuma',
  items: [
    { name: 'A'.repeat(60), price: 100000 },
    { name: 'Produk', price: 50000 },
  ],
};

describe('DuitkuClient', () => {
  beforeEach(() => post.mockReset());

  it('requires every setting', async () => {
    const unconfigured = client({ PAYMENT_CALLBACK_URL: undefined });

    expect(unconfigured.isConfigured()).toBe(false);
    await expect(unconfigured.createInvoice(invoice)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(post).not.toHaveBeenCalled();
  });

  it('creates a signed POP invoice without a payment method', async () => {
    post.mockResolvedValueOnce({
      data: {
        statusCode: '00',
        reference: 'DS123',
        paymentUrl:
          'https://app-sandbox.duitku.com/redirect_checkout?reference=DS123',
      },
    });

    await expect(client().createInvoice(invoice)).resolves.toEqual({
      reference: 'DS123',
      paymentUrl:
        'https://app-sandbox.duitku.com/redirect_checkout?reference=DS123',
    });

    const [url, body, { headers }] = post.mock.calls[0];
    expect(url).toBe(
      'https://api-sandbox.duitku.com/api/merchant/createInvoice',
    );
    expect(body).toMatchObject({
      paymentAmount: 150000,
      merchantOrderId: 'ORD-20260930-0001',
      email: 'budi@example.test',
      customerVaName: 'Budi Santoso Wijayak',
      callbackUrl: settings.PAYMENT_CALLBACK_URL,
      returnUrl: 'https://fe.test/payment?from=checkout&order_id=order-id',
      expiryPeriod: 60,
    });
    expect(body).not.toHaveProperty('paymentMethod');
    expect(body.itemDetails).toEqual([
      { name: 'A'.repeat(50), price: 100000, quantity: 1 },
      { name: 'Produk', price: 50000, quantity: 1 },
    ]);
    expect(headers['x-duitku-merchantcode']).toBe('DMOCK1');
    expect(headers['x-duitku-signature']).toBe(
      requestSignature('DMOCK1', headers['x-duitku-timestamp'], 'secret-key'),
    );
  });

  it.each([
    [
      'an error response',
      () =>
        post.mockRejectedValueOnce(
          Object.assign(new Error('fail'), {
            isAxiosError: true,
            response: { status: 400, data: { Message: 'bad' } },
          }),
        ),
    ],
    [
      'a timeout',
      () =>
        post.mockRejectedValueOnce(
          Object.assign(new Error('timeout'), {
            isAxiosError: true,
            code: 'ECONNABORTED',
          }),
        ),
    ],
    [
      'a non-success status',
      () =>
        post.mockResolvedValueOnce({
          data: { statusCode: '01', statusMessage: 'no' },
        }),
    ],
  ])('maps %s to 502', async (_case, arrange) => {
    arrange();
    await expect(client().createInvoice(invoice)).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('checks the status with a signed request', async () => {
    post.mockResolvedValueOnce({
      data: {
        statusCode: '00',
        reference: 'DS123',
        amount: '150000',
        fee: '0.00',
      },
    });

    await expect(client().checkStatus('ORD-20260930-0001')).resolves.toEqual({
      statusCode: '00',
      reference: 'DS123',
      amount: '150000',
    });
    const [url, body] = post.mock.calls[0];
    expect(url).toBe(settings.PAYMENT_GATEWAY_STATUS_URL);
    expect(body).toEqual({
      merchantCode: 'DMOCK1',
      merchantOrderId: 'ORD-20260930-0001',
      signature: statusSignature('DMOCK1', 'ORD-20260930-0001', 'secret-key'),
    });
  });

  it('reads a transaction Duitku does not know yet as pending', async () => {
    post.mockRejectedValueOnce(
      Object.assign(new Error('not found'), {
        isAxiosError: true,
        response: { status: 404, data: { Message: 'Transaction not found' } },
      }),
    );

    await expect(client().checkStatus('ORD-20260930-0001')).resolves.toEqual({
      statusCode: '01',
      reference: null,
      amount: null,
    });
  });
});
