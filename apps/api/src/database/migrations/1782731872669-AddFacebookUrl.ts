import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFacebookUrl1782731872669 implements MigrationInterface {
    name = 'AddFacebookUrl1782731872669'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "individuals" ADD "facebookUrl" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "individuals" DROP COLUMN "facebookUrl"`);
    }

}
