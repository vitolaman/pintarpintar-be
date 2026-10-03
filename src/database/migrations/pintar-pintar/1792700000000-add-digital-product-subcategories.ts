import { MigrationInterface, QueryRunner } from 'typeorm';

// The frontend menu's sub-categories, by parent slug. The shared development
// database got them by hand; slugs match those rows.
const SUBCATEGORIES: Array<[name: string, slug: string, parentSlug: string]> = [
  ['Photoshop', 'photoshop', 'desain-grafis'],
  ['Illustrator', 'illustrator', 'desain-grafis'],
  ['Figma', 'figma', 'desain-grafis'],
  ['Video Effect', 'video-effect', 'videografi'],
  ['Sound Effect', 'sound-effect', 'videografi'],
  ['Video Animasi', 'video-animasi', 'videografi'],
];

/**
 * Adds the digital-product sub-categories under their parent categories.
 * Existing rows are left as they are, and a sub-category whose parent is
 * missing or deleted is skipped. Safe to re-run.
 */
export class AddDigitalProductSubcategories1792700000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [name, slug, parentSlug] of SUBCATEGORIES) {
      await queryRunner.query(
        `INSERT INTO categories (name, slug, parent_id)
         SELECT $1, $2, parent.id FROM categories parent
         WHERE parent.slug = $3 AND parent.deleted_at IS NULL
         ON CONFLICT (slug) DO NOTHING`,
        [name, slug, parentSlug],
      );
    }
  }

  // Rows this migration inserted cannot be told apart from rows that already
  // existed, and products may reference them, so reverting keeps them.
  public async down(): Promise<void> {}
}
