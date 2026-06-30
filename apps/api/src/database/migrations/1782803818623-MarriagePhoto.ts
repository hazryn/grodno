import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Zdjęcie ślubu wisi na parze: media.partnershipId pozwala trzymać foto małżeństwa
 * (równolegle do media.individualId dla galerii osoby).
 */
export class MarriagePhoto1782803818623 implements MigrationInterface {
    name = 'MarriagePhoto1782803818623'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "media" ADD "partnershipId" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_media_partnership" ON "media" ("partnershipId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_media_partnership"`);
        await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "partnershipId"`);
    }
}
