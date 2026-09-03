import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCatalog1788316801000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE merchants (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), user_id uuid NOT NULL UNIQUE REFERENCES users(id), store_name varchar NOT NULL, store_description text, lifetime_earnings numeric NOT NULL DEFAULT 0, balance numeric NOT NULL DEFAULT 0, status varchar NOT NULL, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(), deleted_at timestamp, deleted_by uuid REFERENCES users(id) ON DELETE SET NULL)`,
    );
    await q.query(
      `CREATE TABLE categories (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), parent_id uuid REFERENCES categories(id) ON DELETE SET NULL, name varchar NOT NULL, slug varchar NOT NULL, deleted_at timestamp, deleted_by uuid REFERENCES users(id) ON DELETE SET NULL)`,
    );
    await q.query(
      `CREATE TABLE products (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), merchant_id uuid NOT NULL REFERENCES merchants(id), title varchar NOT NULL, description text, price numeric NOT NULL, currency varchar NOT NULL, product_type varchar NOT NULL, is_published boolean NOT NULL DEFAULT false, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id) ON DELETE SET NULL, deleted_at timestamp, deleted_by uuid REFERENCES users(id) ON DELETE SET NULL)`,
    );
    await q.query(
      `CREATE TABLE product_categories (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE, category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE)`,
    );
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(
      'DROP TABLE product_categories, products, categories, merchants CASCADE',
    );
  }
}
