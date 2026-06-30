import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Edycja osób przez UI: rozszerza `media` z referencji GEDCOM do realnego zdjęcia
 * galerii (storageKey w MinIO + metadane), dodaje oznaczenia osób (`media_tags`),
 * uczestników zdarzeń (`event_participants`, np. chrzestni) i `individuals.instagramUrl`.
 * xref w media staje się nullable (upload nie ma xref) — unikalność tylko gdy xref NOT NULL.
 */
export class PersonEditing1782799362989 implements MigrationInterface {
    name = 'PersonEditing1782799362989'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // --- individuals: Instagram ---
        await queryRunner.query(`ALTER TABLE "individuals" ADD "instagramUrl" character varying`);

        // --- media: realne zdjęcia galerii/avatar ---
        await queryRunner.query(`ALTER TABLE "media" ALTER COLUMN "xref" DROP NOT NULL`);
        await queryRunner.query(`DROP INDEX "IDX_a99f808f1f52d9901389a92e3a"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_media_tree_xref" ON "media" ("treeId", "xref") WHERE "xref" IS NOT NULL`);
        await queryRunner.query(`ALTER TABLE "media" ADD "individualId" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_media_individual" ON "media" ("individualId")`);
        await queryRunner.query(`ALTER TABLE "media" ADD "storageKey" character varying`);
        await queryRunner.query(`ALTER TABLE "media" ADD "mimeType" character varying`);
        await queryRunner.query(`ALTER TABLE "media" ADD "width" integer`);
        await queryRunner.query(`ALTER TABLE "media" ADD "height" integer`);
        await queryRunner.query(`ALTER TABLE "media" ADD "caption" text`);
        await queryRunner.query(`ALTER TABLE "media" ADD "takenDate" jsonb`);
        await queryRunner.query(`ALTER TABLE "media" ADD "sortOrder" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "media" ADD "isAvatar" boolean NOT NULL DEFAULT false`);

        // --- media_tags: oznaczenia osób na zdjęciu (0..1) ---
        await queryRunner.query(`CREATE TABLE "media_tags" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "treeId" uuid NOT NULL,
            "mediaId" uuid NOT NULL,
            "individualId" uuid,
            "name" character varying,
            "x" double precision NOT NULL,
            "y" double precision NOT NULL,
            "w" double precision NOT NULL,
            "h" double precision NOT NULL,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_media_tags" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_media_tags_tree" ON "media_tags" ("treeId")`);
        await queryRunner.query(`CREATE INDEX "IDX_media_tags_media" ON "media_tags" ("mediaId")`);

        // --- event_participants: chrzestni/świadkowie/celebrans ---
        await queryRunner.query(`CREATE TABLE "event_participants" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "treeId" uuid NOT NULL,
            "eventId" uuid NOT NULL,
            "individualId" uuid,
            "name" character varying,
            "role" character varying NOT NULL DEFAULT 'other',
            "sortOrder" integer NOT NULL DEFAULT '0',
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_event_participants" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_event_participants_tree" ON "event_participants" ("treeId")`);
        await queryRunner.query(`CREATE INDEX "IDX_event_participants_event" ON "event_participants" ("eventId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "event_participants"`);
        await queryRunner.query(`DROP TABLE "media_tags"`);

        await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "isAvatar"`);
        await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "sortOrder"`);
        await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "takenDate"`);
        await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "caption"`);
        await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "height"`);
        await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "width"`);
        await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "mimeType"`);
        await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "storageKey"`);
        await queryRunner.query(`DROP INDEX "IDX_media_individual"`);
        await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "individualId"`);
        await queryRunner.query(`DROP INDEX "IDX_media_tree_xref"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_a99f808f1f52d9901389a92e3a" ON "media" ("treeId", "xref")`);
        await queryRunner.query(`ALTER TABLE "media" ALTER COLUMN "xref" SET NOT NULL`);

        await queryRunner.query(`ALTER TABLE "individuals" DROP COLUMN "instagramUrl"`);
    }
}
