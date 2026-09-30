import { EntityManager } from 'typeorm';

/**
 * Voucher codes (`coupons`) and discount codes share one case-insensitive
 * namespace so checkout can resolve any entered code unambiguously. Each
 * table's unique index guards itself; this check covers the cross-table
 * case under a per-code transaction lock, so concurrent writers serialize.
 */
export async function isPromoCodeAvailable(
  manager: EntityManager,
  code: string,
  exclude: { voucherId?: string; discountCodeId?: string } = {},
): Promise<boolean> {
  await manager.query('SELECT pg_advisory_xact_lock(hashtext(upper($1)))', [
    code,
  ]);

  const rows = (await manager.query(
    `
      SELECT 1 FROM coupons
      WHERE upper(code) = upper($1) AND deleted_at IS NULL
        AND ($2::uuid IS NULL OR id <> $2)
      UNION ALL
      SELECT 1 FROM discount_codes
      WHERE upper(code) = upper($1) AND deleted_at IS NULL
        AND ($3::uuid IS NULL OR id <> $3)
      LIMIT 1
    `,
    [code, exclude.voucherId ?? null, exclude.discountCodeId ?? null],
  )) as unknown[];

  return rows.length === 0;
}
