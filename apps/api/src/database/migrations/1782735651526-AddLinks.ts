import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLinks1782735651526 implements MigrationInterface {
    name = 'AddLinks1782735651526'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "individuals" ADD "links" jsonb NOT NULL DEFAULT '[]'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "individuals" DROP COLUMN "links"`);
    }

}
