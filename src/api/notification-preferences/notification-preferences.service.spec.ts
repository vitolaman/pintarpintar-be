import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserNotificationPreferences } from '../merchant/entities/user-notification-preferences.entity';
import { NotificationPreferencesService } from './notification-preferences.service';
import { EMAIL_PREFERENCE_FIELDS } from './preference-fields';

describe('NotificationPreferencesService', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  let manager: {
    existsBy: jest.Mock;
    findOneBy: jest.Mock;
    update: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let insert: {
    insert: jest.Mock;
    into: jest.Mock;
    values: jest.Mock;
    onConflict: jest.Mock;
    execute: jest.Mock;
  };
  let service: NotificationPreferencesService;

  beforeEach(() => {
    insert = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      onConflict: jest.fn().mockReturnThis(),
      execute: jest.fn(),
    };
    manager = {
      existsBy: jest.fn().mockResolvedValue(true),
      findOneBy: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
      createQueryBuilder: jest.fn(() => insert),
    };
    service = new NotificationPreferencesService({
      manager,
      transaction: (work) => work(manager),
    } as unknown as DataSource);
  });

  it('returns twelve enabled defaults without creating a row or granting roles', async () => {
    const result = await service.findEmailPreferences(userId);
    expect(result.data).toEqual(
      Object.fromEntries(
        Object.keys(EMAIL_PREFERENCE_FIELDS).map((key) => [key, true]),
      ),
    );
    expect(manager.createQueryBuilder).not.toHaveBeenCalled();
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('preserves saved opt-outs', async () => {
    manager.findOneBy.mockResolvedValue({
      emailOrderPaid: false,
      emailCashflowSuccess: false,
    });
    expect((await service.findEmailPreferences(userId)).data).toMatchObject({
      email_order_paid: false,
      email_cashflow_success: false,
      email_new_sale: true,
    });
  });

  it('rejects deleted or absent users in the service', async () => {
    manager.existsBy.mockResolvedValue(false);
    await expect(service.findEmailPreferences(userId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.updateEmailPreferences(userId, { email_new_sale: false }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(insert.execute).not.toHaveBeenCalled();
  });

  it('creates conflict-safely and updates only provided fields, including false', async () => {
    manager.findOneBy.mockResolvedValue({
      emailOrderPaid: false,
      emailNewSale: true,
    });
    const result = await service.updateEmailPreferences(userId, {
      email_order_paid: false,
    });
    expect(insert.values).toHaveBeenCalledWith({ userId });
    expect(insert.onConflict).toHaveBeenCalledWith('("user_id") DO NOTHING');
    expect(manager.update).toHaveBeenCalledWith(
      UserNotificationPreferences,
      { userId },
      { emailOrderPaid: false },
    );
    expect(result.data).toMatchObject({
      email_order_paid: false,
      email_new_sale: true,
    });
  });

  it('empty PATCH does not overwrite existing fields', async () => {
    manager.findOneBy.mockResolvedValue({ emailNewSale: false });
    expect(
      (await service.updateEmailPreferences(userId, {})).data.email_new_sale,
    ).toBe(false);
    expect(manager.update).not.toHaveBeenCalled();
  });
});
