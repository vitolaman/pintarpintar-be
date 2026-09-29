import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHelpTickets1790812800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE help_ticket_type_enum AS ENUM ('kritik', 'pujian', 'saran')
    `);

    await queryRunner.query(`
      CREATE TABLE help_tickets (
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
      CREATE INDEX idx_help_tickets_user_created
      ON help_tickets (user_id, created_at DESC)
      WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX idx_help_tickets_user_created');
    await queryRunner.query('DROP TABLE help_tickets');
    await queryRunner.query('DROP TYPE help_ticket_type_enum');
  }
}
