import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { UserNotificationPreferences } from '../merchant/entities/user-notification-preferences.entity';
import {
  EMAIL_PREFERENCE_FIELDS,
  MERCHANT_PREFERENCE_FIELDS,
  PreferencePatch,
  preferenceValues,
} from './preference-fields';

@Injectable()
export class NotificationPreferencesService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findEmailPreferences(userId: string) {
    const preferences = await this.find(userId);
    return {
      data: preferenceValues(EMAIL_PREFERENCE_FIELDS, preferences),
      responseMessage: 'Get email notification preferences success',
    };
  }

  async updateEmailPreferences(userId: string, input: PreferencePatch) {
    const preferences = await this.dataSource.transaction((manager) =>
      this.update(manager, userId, input),
    );
    return {
      data: preferenceValues(EMAIL_PREFERENCE_FIELDS, preferences),
      responseMessage: 'Update email notification preferences success',
    };
  }

  async find(userId: string): Promise<UserNotificationPreferences | null> {
    await this.assertUser(this.dataSource.manager, userId);
    return this.dataSource.manager.findOneBy(UserNotificationPreferences, {
      userId,
    });
  }

  async update(
    manager: EntityManager,
    userId: string,
    input: PreferencePatch,
  ): Promise<UserNotificationPreferences> {
    await this.assertUser(manager, userId);
    await this.ensureRow(manager, userId);
    const fields = {
      ...EMAIL_PREFERENCE_FIELDS,
      ...MERCHANT_PREFERENCE_FIELDS,
    };
    const changes: Partial<UserNotificationPreferences> = {};
    for (const key of Object.keys(fields) as Array<keyof typeof fields>) {
      if (input[key] !== undefined) changes[fields[key]] = input[key];
    }
    if (Object.keys(changes).length) {
      await manager.update(UserNotificationPreferences, { userId }, changes);
    }
    const preferences = await manager.findOneBy(UserNotificationPreferences, {
      userId,
    });
    if (!preferences)
      throw new NotFoundException('Notification preferences not found');
    return preferences;
  }

  async ensureRow(manager: EntityManager, userId: string): Promise<void> {
    // Conflict-safe creation shares the unique account key with registration.
    await manager
      .createQueryBuilder()
      .insert()
      .into(UserNotificationPreferences)
      .values({ userId })
      .onConflict('("user_id") DO NOTHING')
      .execute();
  }

  private async assertUser(
    manager: EntityManager,
    userId: string,
  ): Promise<void> {
    if (!(await manager.existsBy(User, { id: userId })))
      throw new NotFoundException('User not found');
  }
}
