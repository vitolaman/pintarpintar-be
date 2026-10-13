import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  normalizePhone,
  STORED_PHONE,
} from '../../../common/phone/phone-number';

// Every stored phone number, in the form the API now accepts.
const PHONE_COLUMNS: Array<[table: string, column: string]> = [
  ['user_profiles', 'phone'],
  ['merchant_profiles', 'public_phone'],
  ['job_applications', 'phone'],
  ['certification_partnership_requests', 'phone'],
];

/**
 * Stores phone numbers as digits with their country code (62… for Indonesian
 * numbers; owner decision, 2026-10-13), so they work in wa.me links. A value
 * that is not a phone number of 8 to 15 digits is left as it is. Safe to
 * re-run: stored numbers are already in that form.
 */
export class NormalizePhoneNumbers1794700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, column] of PHONE_COLUMNS) {
      const rows: Array<{ id: string; phone: string }> =
        await queryRunner.query(
          `SELECT id, ${column} AS phone FROM ${table} WHERE ${column} IS NOT NULL`,
        );
      const changes = rows
        .map((row) => ({ id: row.id, phone: normalizePhone(row.phone) }))
        .filter(
          (row, index) =>
            row.phone !== null &&
            STORED_PHONE.test(row.phone) &&
            row.phone !== rows[index].phone,
        );
      if (changes.length === 0) continue;
      await queryRunner.query(
        `UPDATE ${table} target SET ${column} = change.phone
         FROM unnest($1::uuid[], $2::varchar[]) AS change(id, phone)
         WHERE target.id = change.id`,
        [changes.map((row) => row.id), changes.map((row) => row.phone)],
      );
    }
  }

  // The typed formatting is not kept, so there is nothing to restore; the
  // stored numbers stay valid for the previous code.
  public async down(): Promise<void> {}
}
