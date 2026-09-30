import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { LandingLayout } from './entities/merchant-profile.entity';

// Sections of the merchant landing page, in the frontend's default order.
export const LANDING_SECTIONS = [
  'best_seller',
  'bootcamp',
  'kelas',
  'digital',
  'bundles',
] as const;
export type LandingSection = (typeof LANDING_SECTIONS)[number];

const MAX_ITEMS_PER_SECTION = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Validates the shape of a client-supplied layout and returns a clean copy.
export function normalizeLandingLayout(input: unknown): LandingLayout {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('landing_layout must be an object');
  }
  const { section_order, item_order } = input as Record<string, unknown>;

  if (!Array.isArray(section_order)) {
    throw new BadRequestException(
      'landing_layout.section_order must be a list',
    );
  }
  const sections = section_order.map(String);
  if (
    new Set(sections).size !== sections.length ||
    sections.some((section) => !isSection(section))
  ) {
    throw new BadRequestException(
      `landing_layout.section_order accepts unique values of: ${LANDING_SECTIONS.join(', ')}`,
    );
  }

  const items: Record<string, string[]> = {};
  if (item_order !== undefined) {
    if (
      !item_order ||
      typeof item_order !== 'object' ||
      Array.isArray(item_order)
    ) {
      throw new BadRequestException(
        'landing_layout.item_order must be an object',
      );
    }
    for (const [section, ids] of Object.entries(item_order)) {
      if (!isSection(section)) {
        throw new BadRequestException(`Unknown landing section: ${section}`);
      }
      if (
        !Array.isArray(ids) ||
        ids.length > MAX_ITEMS_PER_SECTION ||
        ids.some((id) => typeof id !== 'string' || !UUID.test(id)) ||
        new Set(ids).size !== ids.length
      ) {
        throw new BadRequestException(
          `landing_layout.item_order.${section} must be up to ${MAX_ITEMS_PER_SECTION} unique item ids`,
        );
      }
      items[section] = ids.map((id) => id.toLowerCase());
    }
  }
  return { section_order: sections, item_order: items };
}

// Every ordered item must be the merchant's own item of the section's kind.
export async function assertLayoutItemsOwned(
  manager: EntityManager,
  merchantId: string,
  layout: LandingLayout,
): Promise<void> {
  const entries = Object.entries(layout.item_order).flatMap(([section, ids]) =>
    ids.map((id) => ({ section, id })),
  );
  if (entries.length === 0) return;

  const [{ missing }] = await manager.query(
    `SELECT count(*)::integer AS missing
     FROM jsonb_to_recordset($2::jsonb) AS entry(section text, id uuid)
     WHERE NOT EXISTS (
       SELECT 1 FROM classes class
       WHERE class.id = entry.id AND class.merchant_id = $1 AND class.deleted_at IS NULL
         AND (entry.section = 'best_seller'
           OR (entry.section = 'bootcamp' AND class.type = 'live-bootcamp')
           OR (entry.section = 'kelas' AND class.type <> 'live-bootcamp'))
       UNION ALL
       SELECT 1 FROM products product
       WHERE product.id = entry.id AND product.merchant_id = $1 AND product.deleted_at IS NULL
         AND entry.section IN ('best_seller', 'digital')
       UNION ALL
       SELECT 1 FROM bundles bundle
       WHERE bundle.id = entry.id AND bundle.merchant_id = $1 AND bundle.deleted_at IS NULL
         AND entry.section = 'bundles'
     )`,
    [merchantId, JSON.stringify(entries)],
  );
  if (missing > 0) {
    throw new BadRequestException(
      'landing_layout.item_order contains items that are not this merchant’s items of that section',
    );
  }
}

function isSection(value: string): value is LandingSection {
  return (LANDING_SECTIONS as readonly string[]).includes(value);
}
