import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBio1782749582019 implements MigrationInterface {
    name = 'AddBio1782749582019'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "individuals" ADD COLUMN IF NOT EXISTS "bio" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "individuals" DROP COLUMN "bio"`);
    }

}
