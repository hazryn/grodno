import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDeceased1782407280590 implements MigrationInterface {
    name = 'AddDeceased1782407280590'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "individuals" ADD "deceased" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "individuals" DROP COLUMN "deceased"`);
    }

}
