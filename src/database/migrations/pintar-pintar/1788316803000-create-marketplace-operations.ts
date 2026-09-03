import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMarketplaceOperations1788316803000
  implements MigrationInterface
{
  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE bootcamp_admins (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), bootcamp_id uuid NOT NULL REFERENCES bootcamps(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id), role varchar NOT NULL)`,
    );
    await q.query(
      `CREATE TABLE bootcamp_posts (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), bootcamp_id uuid NOT NULL REFERENCES bootcamps(id) ON DELETE CASCADE, author_id uuid NOT NULL REFERENCES users(id), content text NOT NULL, attachment_url varchar, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id) ON DELETE SET NULL, deleted_at timestamp, deleted_by uuid REFERENCES users(id) ON DELETE SET NULL)`,
    );
    await q.query(
      `CREATE TABLE bootcamp_comments (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), post_id uuid NOT NULL REFERENCES bootcamp_posts(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id), content text NOT NULL, created_at timestamp NOT NULL DEFAULT now(), deleted_at timestamp, deleted_by uuid REFERENCES users(id) ON DELETE SET NULL)`,
    );
    await q.query(
      `CREATE TABLE bootcamp_meetings (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), bootcamp_id uuid NOT NULL REFERENCES bootcamps(id) ON DELETE CASCADE, title varchar NOT NULL, meeting_url varchar NOT NULL, scheduled_at timestamp NOT NULL, duration_minutes integer NOT NULL, deleted_at timestamp, deleted_by uuid REFERENCES users(id) ON DELETE SET NULL)`,
    );
    await q.query(
      `CREATE TABLE coupons (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), merchant_id uuid NOT NULL REFERENCES merchants(id), code varchar NOT NULL, discount_type varchar NOT NULL, discount_value numeric NOT NULL, max_uses integer, expires_at timestamp, is_active boolean NOT NULL DEFAULT true, deleted_at timestamp, deleted_by uuid REFERENCES users(id) ON DELETE SET NULL)`,
    );
    await q.query(
      `CREATE TABLE orders (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), user_id uuid NOT NULL REFERENCES users(id), coupon_id uuid REFERENCES coupons(id) ON DELETE SET NULL, total_amount numeric NOT NULL, discount_amount numeric NOT NULL DEFAULT 0, status varchar NOT NULL, payment_gateway_ref varchar, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now())`,
    );
    await q.query(
      `CREATE TABLE order_items (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE, product_id uuid NOT NULL REFERENCES products(id), price_at_purchase numeric NOT NULL)`,
    );
    await q.query(
      `CREATE TABLE coupon_usages (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), coupon_id uuid NOT NULL REFERENCES coupons(id), user_id uuid NOT NULL REFERENCES users(id), order_id uuid NOT NULL REFERENCES orders(id), used_at timestamp NOT NULL DEFAULT now())`,
    );
    await q.query(
      `CREATE TABLE user_access (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), user_id uuid NOT NULL REFERENCES users(id), product_id uuid NOT NULL REFERENCES products(id), granted_at timestamp NOT NULL DEFAULT now(), expires_at timestamp)`,
    );
    await q.query(
      `CREATE TABLE reviews (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), product_id uuid NOT NULL REFERENCES products(id), user_id uuid NOT NULL REFERENCES users(id), order_id uuid NOT NULL REFERENCES orders(id), rating integer NOT NULL, comment text, created_at timestamp NOT NULL DEFAULT now(), deleted_at timestamp, deleted_by uuid REFERENCES users(id) ON DELETE SET NULL)`,
    );
    await q.query(
      `CREATE TABLE wishlist (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), user_id uuid NOT NULL REFERENCES users(id), product_id uuid NOT NULL REFERENCES products(id), added_at timestamp NOT NULL DEFAULT now())`,
    );
    await q.query(
      `CREATE TABLE merchant_payouts (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), merchant_id uuid NOT NULL REFERENCES merchants(id), amount numeric NOT NULL, status varchar NOT NULL, destination_bank_account varchar NOT NULL, requested_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now())`,
    );
    await q.query(
      `CREATE TABLE payout_items (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), payout_id uuid NOT NULL REFERENCES merchant_payouts(id) ON DELETE CASCADE, order_item_id uuid NOT NULL REFERENCES order_items(id), amount numeric NOT NULL)`,
    );
    await q.query(
      `CREATE TABLE product_views (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), product_id uuid NOT NULL REFERENCES products(id), view_date date NOT NULL, view_count integer NOT NULL DEFAULT 0)`,
    );
    await q.query(
      `CREATE TABLE merchant_daily_stats (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), merchant_id uuid NOT NULL REFERENCES merchants(id), stat_date date NOT NULL, daily_revenue numeric NOT NULL DEFAULT 0, daily_orders integer NOT NULL DEFAULT 0, daily_product_views integer NOT NULL DEFAULT 0)`,
    );
    await q.query(
      `CREATE TABLE student_progress (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), access_id uuid NOT NULL REFERENCES user_access(id), last_video_id uuid REFERENCES videos(id) ON DELETE SET NULL, completion_percentage numeric NOT NULL DEFAULT 0, total_time_spent integer NOT NULL DEFAULT 0, last_accessed_at timestamp)`,
    );
    await q.query(
      `CREATE TABLE notifications (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), user_id uuid NOT NULL REFERENCES users(id), type varchar NOT NULL, title varchar NOT NULL, body text NOT NULL, ref_type varchar, ref_id uuid, is_read boolean NOT NULL DEFAULT false, created_at timestamp NOT NULL DEFAULT now())`,
    );
    await q.query(
      `CREATE TABLE audit_logs (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), user_id uuid NOT NULL REFERENCES users(id), table_name varchar NOT NULL, record_id uuid NOT NULL, action varchar NOT NULL, old_values jsonb, new_values jsonb, created_at timestamp NOT NULL DEFAULT now())`,
    );
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(
      'DROP TABLE audit_logs, notifications, student_progress, merchant_daily_stats, product_views, payout_items, merchant_payouts, wishlist, reviews, user_access, coupon_usages, order_items, orders, coupons, bootcamp_meetings, bootcamp_comments, bootcamp_posts, bootcamp_admins CASCADE',
    );
  }
}
