import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Komunitas: groups, their members and join requests, threads, replies and
 * likes. A join request is a `pending` member row; rejecting, cancelling or
 * leaving soft-deletes it. Safe to re-run.
 */
export class CreateCommunityTables1794000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS community_groups (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        owner_user_id uuid NOT NULL REFERENCES users(id),
        name varchar(80) NOT NULL,
        description varchar(500),
        image_asset_id uuid NOT NULL REFERENCES file_assets(id),
        access varchar(16) NOT NULL
          CONSTRAINT chk_community_groups_access CHECK (access IN ('public', 'request')),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS community_group_members (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        group_id uuid NOT NULL REFERENCES community_groups(id),
        user_id uuid NOT NULL REFERENCES users(id),
        role varchar(16) NOT NULL
          CONSTRAINT chk_community_group_members_role CHECK (role IN ('owner', 'member')),
        status varchar(16) NOT NULL
          CONSTRAINT chk_community_group_members_status CHECK (status IN ('active', 'pending')),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS community_threads (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        group_id uuid NOT NULL REFERENCES community_groups(id),
        author_user_id uuid NOT NULL REFERENCES users(id),
        content text NOT NULL DEFAULT '',
        attachment_asset_id uuid REFERENCES file_assets(id),
        class_id uuid REFERENCES classes(id),
        product_id uuid REFERENCES products(id),
        bundle_id uuid REFERENCES bundles(id),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp,
        CONSTRAINT chk_community_threads_single_item
          CHECK (num_nonnulls(class_id, product_id, bundle_id) <= 1)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS community_replies (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        thread_id uuid NOT NULL REFERENCES community_threads(id),
        author_user_id uuid NOT NULL REFERENCES users(id),
        content text NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS community_likes (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL REFERENCES users(id),
        thread_id uuid REFERENCES community_threads(id),
        reply_id uuid REFERENCES community_replies(id),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp,
        CONSTRAINT chk_community_likes_single_target
          CHECK (num_nonnulls(thread_id, reply_id) = 1)
      )
    `);
    const indexes = [
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_community_group_members_group_user
       ON community_group_members (group_id, user_id) WHERE deleted_at IS NULL`,
      `CREATE INDEX IF NOT EXISTS idx_community_group_members_user
       ON community_group_members (user_id) WHERE deleted_at IS NULL`,
      `CREATE INDEX IF NOT EXISTS idx_community_groups_created
       ON community_groups (created_at DESC) WHERE deleted_at IS NULL`,
      `CREATE INDEX IF NOT EXISTS idx_community_threads_group_created
       ON community_threads (group_id, created_at DESC) WHERE deleted_at IS NULL`,
      `CREATE INDEX IF NOT EXISTS idx_community_replies_thread_created
       ON community_replies (thread_id, created_at) WHERE deleted_at IS NULL`,
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_community_likes_user_thread
       ON community_likes (user_id, thread_id) WHERE thread_id IS NOT NULL AND deleted_at IS NULL`,
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_community_likes_user_reply
       ON community_likes (user_id, reply_id) WHERE reply_id IS NOT NULL AND deleted_at IS NULL`,
    ];
    for (const index of indexes) await queryRunner.query(index);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'community_likes',
      'community_replies',
      'community_threads',
      'community_group_members',
      'community_groups',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${table}`);
    }
  }
}
