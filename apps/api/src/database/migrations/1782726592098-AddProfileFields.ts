import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProfileFields1782726592098 implements MigrationInterface {
    name = 'AddProfileFields1782726592098'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "individuals" ADD "linkedinUrl" character varying`);
        await queryRunner.query(`ALTER TABLE "individuals" ADD "xUrl" character varying`);
        await queryRunner.query(`ALTER TABLE "individuals" ADD "emails" jsonb NOT NULL DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "individuals" ADD "experience" jsonb NOT NULL DEFAULT '[]'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "individuals" DROP COLUMN "experience"`);
        await queryRunner.query(`ALTER TABLE "individuals" DROP COLUMN "emails"`);
        await queryRunner.query(`ALTER TABLE "individuals" DROP COLUMN "xUrl"`);
        await queryRunner.query(`ALTER TABLE "individuals" DROP COLUMN "linkedinUrl"`);
    }

}
