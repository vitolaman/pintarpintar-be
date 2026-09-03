import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProductContent1788316802000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE digital_files (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), product_id uuid NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE, file_url varchar NOT NULL, file_format varchar NOT NULL, file_size integer NOT NULL)`,
    );
    await q.query(
      `CREATE TABLE video_classes (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), product_id uuid NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE, total_duration integer NOT NULL)`,
    );
    await q.query(
      `CREATE TABLE videos (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), video_class_id uuid NOT NULL REFERENCES video_classes(id) ON DELETE CASCADE, title varchar NOT NULL, video_url varchar NOT NULL, order_index integer NOT NULL, duration_seconds integer NOT NULL, deleted_at timestamp, deleted_by uuid REFERENCES users(id) ON DELETE SET NULL)`,
    );
    await q.query(
      `CREATE TABLE bootcamps (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), product_id uuid NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE, start_date date NOT NULL, end_date date NOT NULL, max_students integer NOT NULL, updated_at timestamp NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id) ON DELETE SET NULL)`,
    );
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(
      'DROP TABLE bootcamps, videos, video_classes, digital_files CASCADE',
    );
  }
}
