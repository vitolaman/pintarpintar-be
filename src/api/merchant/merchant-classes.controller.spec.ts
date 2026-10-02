import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { ClassService } from '~/class/class.service';
import { MerchantController } from './merchant.controller';
import { MerchantService } from './merchant.service';
import { MerchantWithdrawalService } from './merchant-withdrawal.service';

const userId = '10000000-0000-4000-8000-000000000001';
const merchantId = '20000000-0000-4000-8000-000000000001';

class SignedInGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    context.switchToHttp().getRequest().user = { id: userId };
    return true;
  }
}

describe('MerchantController classes', () => {
  let app: INestApplication;
  const merchantService = { findOwnMerchantId: jest.fn() };
  const classService = {
    createClass: jest.fn(),
    getClassesByMerchant: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [MerchantController],
      providers: [
        { provide: MerchantService, useValue: merchantService },
        { provide: ClassService, useValue: classService },
        { provide: MerchantWithdrawalService, useValue: {} },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalGuards(new SignedInGuard());
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("lists the classes of the caller's own merchant", async () => {
    merchantService.findOwnMerchantId.mockResolvedValue(merchantId);
    classService.getClassesByMerchant.mockResolvedValue({ data: [] });

    await request(app.getHttpServer())
      .get('/api/v1/merchant/classes')
      .expect(200);

    expect(merchantService.findOwnMerchantId).toHaveBeenCalledWith(userId);
    expect(classService.getClassesByMerchant).toHaveBeenCalledWith(
      userId,
      merchantId,
      expect.any(Object),
    );
  });

  it("creates the class in the caller's own merchant", async () => {
    merchantService.findOwnMerchantId.mockResolvedValue(merchantId);
    classService.createClass.mockResolvedValue({ data: {} });

    await request(app.getHttpServer())
      .post('/api/v1/merchant/classes')
      .send({ title: 'Kelas', type: 'kelas' })
      .expect(201);

    expect(classService.createClass).toHaveBeenCalledWith(
      userId,
      merchantId,
      expect.objectContaining({ title: 'Kelas' }),
    );
  });

  it('returns 404 when the caller owns no merchant', async () => {
    merchantService.findOwnMerchantId.mockRejectedValue(
      new NotFoundException('Merchant not found'),
    );

    await request(app.getHttpServer())
      .get('/api/v1/merchant/classes')
      .expect(404);

    expect(classService.getClassesByMerchant).not.toHaveBeenCalled();
  });
});
