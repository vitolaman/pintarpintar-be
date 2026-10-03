import { MigrationInterface, QueryRunner } from 'typeorm';

// The frontend's digital-product categories that no earlier migration
// creates; the shared development database got them by hand. Slugs match
// those rows.
const CATEGORIES: Array<[name: string, slug: string]> = [
  ['PDF', 'pdf'],
  ['Template', 'template'],
  ['E-book', 'e-book'],
  ['Template Canva', 'template-canva'],
  ['Desain Grafis', 'desain-grafis'],
];

/**
 * Completes the frontend's nine digital-product categories on databases built
 * from migrations. Existing rows are left as they are. Safe to re-run.
 */
export class AddFrontendProductCategories1792600000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [name, slug] of CATEGORIES) {
      await queryRunner.query(
        'INSERT INTO categories (name, slug) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING',
        [name, slug],
      );
    }
  }

  // Rows this migration inserted cannot be told apart from rows that already
  // existed, and products may reference them, so reverting keeps them.
  public async down(): Promise<void> {}
}
