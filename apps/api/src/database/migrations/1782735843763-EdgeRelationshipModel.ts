import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Model krawędziowy relacji osoba↔osoba (DB = źródło prawdy). Tworzy parent_child +
 * partnerships i przepisuje istniejące dane z families/family_children (zachowując ID:
 * partnership.id = family.id). Stare tabele zostają (drop w osobnej migracji po walidacji).
 * xref staje się nullable (artefakt importu, nie tożsamość).
 */
export class EdgeRelationshipModel1782735843763 implements MigrationInterface {
    name = 'EdgeRelationshipModel1782735843763'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // xref przestaje być tożsamością
        await queryRunner.query(`ALTER TABLE "individuals" ALTER COLUMN "xref" DROP NOT NULL`);

        // zdarzenia rodzinne mogą wisieć na parze
        await queryRunner.query(`ALTER TABLE "events" ADD "partnershipId" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_events_partnership" ON "events" ("partnershipId")`);

        // krawędzie rodzic→dziecko
        await queryRunner.query(`CREATE TABLE "parent_child" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "treeId" uuid NOT NULL,
            "parentId" uuid NOT NULL,
            "childId" uuid NOT NULL,
            "parentRole" character varying(8) NOT NULL DEFAULT 'parent',
            "pedigree" character varying NOT NULL DEFAULT 'birth',
            "sortOrder" integer NOT NULL DEFAULT '0',
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_parent_child" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_pc_tree_child" ON "parent_child" ("treeId", "childId")`);
        await queryRunner.query(`CREATE INDEX "IDX_pc_tree_parent" ON "parent_child" ("treeId", "parentId")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_pc_parent_child" ON "parent_child" ("parentId", "childId")`);

        // związki par (małżeństwo/partner)
        await queryRunner.query(`CREATE TABLE "partnerships" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "treeId" uuid NOT NULL,
            "partnerAId" uuid,
            "partnerBId" uuid,
            "type" character varying(16) NOT NULL DEFAULT 'married',
            "sortOrder" integer NOT NULL DEFAULT '0',
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            "deletedAt" TIMESTAMP,
            CONSTRAINT "PK_partnerships" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_pt_tree_a" ON "partnerships" ("treeId", "partnerAId")`);
        await queryRunner.query(`CREATE INDEX "IDX_pt_tree_b" ON "partnerships" ("treeId", "partnerBId")`);

        // --- backfill ze starego modelu (zachowujemy family.id jako partnership.id) ---
        await queryRunner.query(`
            INSERT INTO "partnerships" ("id","treeId","partnerAId","partnerBId","type","sortOrder","createdAt")
            SELECT f."id", f."treeId", f."husbandId", f."wifeId",
                   CASE WHEN EXISTS (SELECT 1 FROM "events" e WHERE e."familyId"=f."id" AND e."type"='MARR')
                        THEN 'married' ELSE 'partner' END,
                   0, f."createdAt"
            FROM "families" f`);

        await queryRunner.query(`UPDATE "events" SET "partnershipId" = "familyId" WHERE "familyId" IS NOT NULL`);

        await queryRunner.query(`
            INSERT INTO "parent_child" ("treeId","parentId","childId","parentRole","pedigree","sortOrder")
            SELECT fc."treeId", f."husbandId", fc."childId", 'father', fc."pedigree", fc."sortOrder"
            FROM "family_children" fc JOIN "families" f ON f."id"=fc."familyId"
            WHERE f."husbandId" IS NOT NULL
            ON CONFLICT ("parentId","childId") DO NOTHING`);

        await queryRunner.query(`
            INSERT INTO "parent_child" ("treeId","parentId","childId","parentRole","pedigree","sortOrder")
            SELECT fc."treeId", f."wifeId", fc."childId", 'mother', fc."pedigree", fc."sortOrder"
            FROM "family_children" fc JOIN "families" f ON f."id"=fc."familyId"
            WHERE f."wifeId" IS NOT NULL
            ON CONFLICT ("parentId","childId") DO NOTHING`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "partnerships"`);
        await queryRunner.query(`DROP TABLE "parent_child"`);
        await queryRunner.query(`DROP INDEX "IDX_events_partnership"`);
        await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "partnershipId"`);
        await queryRunner.query(`ALTER TABLE "individuals" ALTER COLUMN "xref" SET NOT NULL`);
    }
}
