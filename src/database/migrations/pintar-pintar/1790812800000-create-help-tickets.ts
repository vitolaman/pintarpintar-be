import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHelpTickets1790812800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'help_ticket_type_enum') THEN
          CREATE TYPE help_ticket_type_enum AS ENUM ('kritik', 'pujian', 'saran');
        END IF;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS help_tickets (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ticket_type help_ticket_type_enum NOT NULL,
        message text NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_help_tickets_user_created
      ON help_tickets (user_id, created_at DESC)
      WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS idx_help_tickets_user_created',
    );
    await queryRunner.query('DROP TABLE IF EXISTS help_tickets');
    await queryRunner.query('DROP TYPE IF EXISTS help_ticket_type_enum');
  }
}
