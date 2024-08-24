import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSocialToken1724473527799 implements MigrationInterface {
    name = 'AddSocialToken1724473527799'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "discord_auth_token" VARCHAR`);
        await queryRunner.query(`ALTER TABLE "users" ADD "twitter_auth_token" VARCHAR`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "twitter_auth_token"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "discord_auth_token"`);
    }

}
