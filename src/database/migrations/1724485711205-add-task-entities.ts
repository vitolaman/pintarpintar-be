import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskEntities1724485711205 implements MigrationInterface {
  name = 'AddTaskEntities1724485711205';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "master_tasks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "task_name" character varying NOT NULL, "url" character varying NOT NULL, "type" character varying NOT NULL, CONSTRAINT "PK_5d5135285b99e91d4c800bf7e0a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tasks_histories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "userId" text NOT NULL, "taskId" text NOT NULL, "user_id" uuid, "task_id" uuid, CONSTRAINT "PK_4ed607c4bb75d8c700cf66374c3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks_histories" ADD CONSTRAINT "FK_5db258384b5f1c5c9814916eb50" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks_histories" ADD CONSTRAINT "FK_508de5700f1765ef282b557360d" FOREIGN KEY ("task_id") REFERENCES "master_tasks"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tasks_histories" DROP CONSTRAINT "FK_508de5700f1765ef282b557360d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks_histories" DROP CONSTRAINT "FK_5db258384b5f1c5c9814916eb50"`,
    );
    await queryRunner.query(`DROP TABLE "tasks_histories"`);
    await queryRunner.query(`DROP TABLE "master_tasks"`);
  }
}
