import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedMasterProfilePicture1725107620801
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO master_profile_picture ("imagePath") VALUES ('/master-profile-pictures/basketball.png');
      INSERT INTO master_profile_picture ("imagePath") VALUES ('/master-profile-pictures/cricket.png');
      INSERT INTO master_profile_picture ("imagePath") VALUES ('/master-profile-pictures/rugby.png');
      INSERT INTO master_profile_picture ("imagePath") VALUES ('/master-profile-pictures/soccer.png');
      INSERT INTO master_profile_picture ("imagePath") VALUES ('/master-profile-pictures/tennis.png');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM master_profile_picture WHERE "imagePath" IN (
        '/master-profile-pictures/basketball.png', 
        '/master-profile-pictures/cricket.png', 
        '/master-profile-pictures/rugby.png', 
        '/master-profile-pictures/soccer.png', 
        '/master-profile-pictures/tennis.png'
        );
    `);
  }
}
