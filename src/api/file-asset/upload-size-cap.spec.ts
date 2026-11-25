import { EntityManager } from 'typeorm';
import { MerchantStorageLevel } from '../merchant/entities/merchant.entity';
import {
  LARGEST_FIXED_UPLOAD_BYTES,
  uploadSizeCap,
  uploadSizeCapDescription,
  uploadSizeCapFor,
  uploadSizeText,
} from './upload-size-cap';

const MB = 1024 * 1024;
const GB = 1024 * MB;
const USER_ID = '30000000-0000-4000-8000-000000000001';
const { BASIC, SILVER, GOLD } = MerchantStorageLevel;

describe('uploadSizeCapFor', () => {
  it('gives a user without merchant content the 500 MB submission limit', () => {
    expect(LARGEST_FIXED_UPLOAD_BYTES).toBe(500 * MB);
    expect(uploadSizeCapFor([])).toBe(500 * MB);
  });

  it.each([
    [BASIC, 1 * GB],
    [SILVER, 5 * GB],
    [GOLD, 10 * GB],
  ])('gives a %s merchant its per-file limit', (level, cap) => {
    expect(uploadSizeCapFor([{ level, hasProBenefits: false }])).toBe(cap);
  });

  it.each([
    [BASIC, 30 * GB],
    [SILVER, 100 * GB],
    [GOLD, 200 * GB],
  ])('gives a Pro %s merchant its storage quota', (level, cap) => {
    expect(uploadSizeCapFor([{ level, hasProBenefits: true }])).toBe(cap);
  });

  it('takes the largest of several merchants (own store and tutored classes)', () => {
    expect(
      uploadSizeCapFor([
        { level: BASIC, hasProBenefits: false },
        { level: GOLD, hasProBenefits: false },
        { level: SILVER, hasProBenefits: false },
      ]),
    ).toBe(10 * GB);
  });
});

describe('uploadSizeCap', () => {
  const managerWith = (
    merchants: Array<{ id: string; storage_level: MerchantStorageLevel }>,
    proMerchantIds: string[] = [],
  ) => {
    const now = Date.now();
    return {
      query: jest.fn().mockResolvedValue(merchants),
      find: jest.fn(async (_entity, { where }) =>
        proMerchantIds.includes(where.merchantId)
          ? [
              {
                status: 'active',
                startsAt: new Date(now - 86_400_000),
                endsAt: new Date(now + 86_400_000),
              },
            ]
          : [],
      ),
    };
  };

  it("reads the user's own and tutored merchants", async () => {
    const manager = managerWith([]);
    await uploadSizeCap(manager as unknown as EntityManager, USER_ID);
    const [sql, params] = manager.query.mock.calls[0];
    expect(params).toEqual([USER_ID]);
    expect(sql).toContain('merchant.user_id = $1');
    expect(sql).toContain('mentor.user_id = $1');
    expect(sql).toContain("mentor.status = 'active'");
    expect(sql).toContain('link.deleted_at IS NULL');
  });

  it('lifts the per-file limit only for the merchant that is Pro', async () => {
    const manager = managerWith(
      [
        { id: 'basic-pro', storage_level: BASIC },
        { id: 'gold', storage_level: GOLD },
      ],
      ['basic-pro'],
    );
    await expect(
      uploadSizeCap(manager as unknown as EntityManager, USER_ID),
    ).resolves.toBe(30 * GB);
  });

  it('applies the level limit after Pro and its grace have ended', async () => {
    const manager = managerWith([{ id: 'm', storage_level: BASIC }]);
    await expect(
      uploadSizeCap(manager as unknown as EntityManager, USER_ID),
    ).resolves.toBe(1 * GB);
  });
});

describe('uploadSizeText', () => {
  it.each([
    [500 * MB, '500 MB'],
    [1 * GB, '1 GB'],
    [30 * GB, '30 GB'],
    [1536 * MB, '1536 MB'],
  ])('writes %p as %s', (bytes, text) => {
    expect(uploadSizeText(bytes)).toBe(text);
  });

  it('documents the caps from the level rules', () => {
    expect(uploadSizeCapDescription()).toContain(
      'at most 500 MB, or more when the caller can attach it',
    );
    expect(uploadSizeCapDescription()).toContain('Basic 1 GB, Silver 5 GB');
    expect(uploadSizeCapDescription()).toContain('Gold 200 GB');
  });
});
