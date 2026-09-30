import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { PAYMENT_EXPIRY_MINUTES } from '../payment.constants';
import { requestSignature, statusSignature } from './duitku-signature';

const REQUEST_TIMEOUT_MS = 15_000;

interface DuitkuConfig {
  // POP API base, e.g. `https://api-sandbox.duitku.com/api`.
  apiBaseUrl: string;
  // Full V2 `transactionStatus` URL (a different host from POP).
  statusUrl: string;
  merchantCode: string;
  apiKey: string;
  callbackUrl: string;
  returnUrl: string;
}

export interface InvoiceRequest {
  orderId: string;
  orderNumber: string;
  amount: number;
  productDetails: string;
  email: string;
  customerName: string;
  // Net line totals; they must sum to `amount`.
  items: Array<{ name: string; price: number }>;
}

export interface Invoice {
  reference: string;
  paymentUrl: string;
}

// `00` success, `01` pending, `02` cancelled or failed.
export interface TransactionStatus {
  statusCode: string;
  reference: string | null;
  amount: string | null;
}

/**
 * Duitku POP client: opens invoices and checks transaction status. The
 * buyer chooses the payment method on Duitku's page, so none is sent.
 * Credentials never leave this class.
 */
@Injectable()
export class DuitkuClient {
  private readonly logger = new Logger(DuitkuClient.name);
  private readonly http: AxiosInstance;
  private readonly config: DuitkuConfig | null;

  constructor(configService: ConfigService) {
    this.http = axios.create({ timeout: REQUEST_TIMEOUT_MS });
    const values = {
      apiBaseUrl: configService.get<string>('PAYMENT_GATEWAY_URL'),
      statusUrl: configService.get<string>('PAYMENT_GATEWAY_STATUS_URL'),
      merchantCode: configService.get<string>('PAYMENT_GATEWAY_MERCHANT_KEY'),
      apiKey: configService.get<string>('PAYMENT_GATEWAY_API_KEY'),
      callbackUrl: configService.get<string>('PAYMENT_CALLBACK_URL'),
      returnUrl: configService.get<string>('PAYMENT_RETURN_URL'),
    };
    this.config = Object.values(values).every(Boolean)
      ? (values as DuitkuConfig)
      : null;
  }

  isConfigured(): boolean {
    return this.config !== null;
  }

  get merchantCode(): string {
    return this.requireConfig().merchantCode;
  }

  get apiKey(): string {
    return this.requireConfig().apiKey;
  }

  requireConfig(): DuitkuConfig {
    if (!this.config) {
      throw new ServiceUnavailableException(
        'Payment gateway is not configured',
      );
    }
    return this.config;
  }

  async createInvoice(request: InvoiceRequest): Promise<Invoice> {
    const config = this.requireConfig();
    const timestamp = String(Date.now());
    const returnUrl = new URL(config.returnUrl);
    returnUrl.searchParams.set('order_id', request.orderId);

    try {
      const { data } = await this.http.post(
        `${config.apiBaseUrl.replace(/\/+$/, '')}/merchant/createInvoice`,
        {
          paymentAmount: request.amount,
          merchantOrderId: request.orderNumber,
          productDetails: request.productDetails.slice(0, 255),
          email: request.email,
          customerVaName: request.customerName.slice(0, 20),
          callbackUrl: config.callbackUrl,
          returnUrl: returnUrl.toString(),
          expiryPeriod: PAYMENT_EXPIRY_MINUTES,
          itemDetails: request.items.map((item) => ({
            name: item.name.slice(0, 50),
            price: item.price,
            quantity: 1,
          })),
        },
        {
          headers: {
            Accept: 'application/json',
            'x-duitku-merchantcode': config.merchantCode,
            'x-duitku-timestamp': timestamp,
            'x-duitku-signature': requestSignature(
              config.merchantCode,
              timestamp,
              config.apiKey,
            ),
          },
        },
      );
      if (data?.statusCode !== '00' || !data.reference || !data.paymentUrl) {
        throw new Error(`status ${data?.statusCode}: ${data?.statusMessage}`);
      }
      return { reference: data.reference, paymentUrl: data.paymentUrl };
    } catch (error) {
      this.logger.error(
        `Duitku invoice for ${request.orderNumber} failed: ${describe(error)}`,
      );
      throw new BadGatewayException('Payment gateway is unavailable');
    }
  }

  async checkStatus(orderNumber: string): Promise<TransactionStatus> {
    const config = this.requireConfig();
    try {
      const { data } = await this.http.post(
        config.statusUrl,
        {
          merchantCode: config.merchantCode,
          merchantOrderId: orderNumber,
          signature: statusSignature(
            config.merchantCode,
            orderNumber,
            config.apiKey,
          ),
        },
        { headers: { Accept: 'application/json' } },
      );
      if (!data?.statusCode) throw new Error('missing statusCode');
      return {
        statusCode: String(data.statusCode),
        reference: data.reference ?? null,
        amount: data.amount != null ? String(data.amount) : null,
      };
    } catch (error) {
      // A POP invoice has no transaction until the buyer picks a payment
      // method on Duitku's page, and Duitku answers 404 until then.
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return { statusCode: '01', reference: null, amount: null };
      }
      this.logger.error(
        `Duitku status check for ${orderNumber} failed: ${describe(error)}`,
      );
      throw new BadGatewayException('Payment gateway is unavailable');
    }
  }
}

// Logs the gateway's status and message only, never request headers.
function describe(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data;
    const message =
      typeof body === 'object' && body !== null
        ? (body.Message ?? body.statusMessage ?? JSON.stringify(body))
        : body;
    return `HTTP ${error.response?.status ?? error.code}: ${String(message ?? error.message).slice(0, 300)}`;
  }
  return error instanceof Error ? error.message : String(error);
}
