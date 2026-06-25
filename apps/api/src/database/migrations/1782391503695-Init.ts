import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1782391503695 implements MigrationInterface {
    name = 'Init1782391503695'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "trees" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "title" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_243b6538aaa70540db7bb1f789b" UNIQUE ("name"), CONSTRAINT "PK_916905d3ddf29a431776817cd8d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "places" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "treeId" uuid NOT NULL, "name" character varying NOT NULL, "town" character varying, "type" character varying, "parentId" uuid, "lat" double precision, "lng" double precision, "countryCode" character varying(2), "gazetteerSource" character varying, "gazetteerId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1afab86e226b4c3bc9a74465c12" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_40e2f5c7ad56564ec797cbb677" ON "places" ("treeId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_49faf665603cff7cc575ea56f3" ON "places" ("treeId", "name") `);
        await queryRunner.query(`CREATE TABLE "individuals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "treeId" uuid NOT NULL, "xref" character varying NOT NULL, "sex" character varying(1) NOT NULL DEFAULT 'U', "names" jsonb NOT NULL DEFAULT '[]', "primaryName" character varying NOT NULL, "isLiving" boolean NOT NULL DEFAULT false, "birthDate" jsonb, "birthYear" integer, "birthPlaceId" uuid, "birthPlaceTown" character varying, "birthPlaceFull" character varying, "deathDate" jsonb, "deathYear" integer, "deathPlaceId" uuid, "lifespan" character varying, "photoMediaId" uuid, "photoUrl" character varying, "hasParents" boolean NOT NULL DEFAULT false, "childCount" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_ebf809180acc8fce381144eb48b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a006b4f2884d261574cfe9ab82" ON "individuals" ("treeId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_98bf31342be99758a217f1615f" ON "individuals" ("treeId", "xref") `);
        await queryRunner.query(`CREATE TABLE "families" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "treeId" uuid NOT NULL, "xref" character varying NOT NULL, "husbandId" uuid, "wifeId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_70414ac0c8f45664cf71324b9bb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_4fd5952c34b8003214c26ecedd" ON "families" ("treeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_66341eded246ecf860d3e5d4a1" ON "families" ("husbandId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c3b7ba0e6f676a18ed636604ed" ON "families" ("wifeId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_727c9d6d1383f4f1a13e7cd7eb" ON "families" ("treeId", "xref") `);
        await queryRunner.query(`CREATE TABLE "family_children" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "treeId" uuid NOT NULL, "familyId" uuid NOT NULL, "childId" uuid NOT NULL, "sortOrder" integer NOT NULL DEFAULT '0', "pedigree" character varying NOT NULL DEFAULT 'birth', CONSTRAINT "PK_4d94ba5414395fdd91ac478ad6f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7e647c4abcf2f77b208f7f5f4f" ON "family_children" ("treeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e39516d0c91136617deb177d80" ON "family_children" ("familyId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e6f0e979519e94abd777730f56" ON "family_children" ("childId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_9ecb797cf8c87deea7d2fa3e24" ON "family_children" ("familyId", "childId") `);
        await queryRunner.query(`CREATE TABLE "events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "treeId" uuid NOT NULL, "ownerType" character varying NOT NULL, "individualId" uuid, "familyId" uuid, "type" character varying NOT NULL, "date" jsonb, "sortKey" integer, "placeId" uuid, "placeName" character varying, "value" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_40731c7151fe4be3116e45ddf73" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d5b316a27b25bb0b98776d49fd" ON "events" ("treeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_dee9fbacaa41e514f358248ff1" ON "events" ("individualId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a4f2982b9fe3d4c07290d19a24" ON "events" ("familyId") `);
        await queryRunner.query(`CREATE TABLE "sources" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "treeId" uuid NOT NULL, "xref" character varying NOT NULL, "title" character varying, "author" character varying, "text" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_85523beafe5a2a6b90b02096443" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2d77793e8d1dceb496d5b5fc1d" ON "sources" ("treeId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_c244e940329d281e48d119c333" ON "sources" ("treeId", "xref") `);
        await queryRunner.query(`CREATE TABLE "media" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "treeId" uuid NOT NULL, "xref" character varying NOT NULL, "title" character varying, "filename" character varying, "format" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f4e0fcac36e050de337b670d8bd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_66936d533a940c3be50b1015c7" ON "media" ("treeId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_a99f808f1f52d9901389a92e3a" ON "media" ("treeId", "xref") `);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "displayName" character varying NOT NULL, "role" character varying NOT NULL DEFAULT 'member', "individualId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a99f808f1f52d9901389a92e3a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_66936d533a940c3be50b1015c7"`);
        await queryRunner.query(`DROP TABLE "media"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c244e940329d281e48d119c333"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2d77793e8d1dceb496d5b5fc1d"`);
        await queryRunner.query(`DROP TABLE "sources"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a4f2982b9fe3d4c07290d19a24"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dee9fbacaa41e514f358248ff1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d5b316a27b25bb0b98776d49fd"`);
        await queryRunner.query(`DROP TABLE "events"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9ecb797cf8c87deea7d2fa3e24"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e6f0e979519e94abd777730f56"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e39516d0c91136617deb177d80"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7e647c4abcf2f77b208f7f5f4f"`);
        await queryRunner.query(`DROP TABLE "family_children"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_727c9d6d1383f4f1a13e7cd7eb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c3b7ba0e6f676a18ed636604ed"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_66341eded246ecf860d3e5d4a1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4fd5952c34b8003214c26ecedd"`);
        await queryRunner.query(`DROP TABLE "families"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_98bf31342be99758a217f1615f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a006b4f2884d261574cfe9ab82"`);
        await queryRunner.query(`DROP TABLE "individuals"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_49faf665603cff7cc575ea56f3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_40e2f5c7ad56564ec797cbb677"`);
        await queryRunner.query(`DROP TABLE "places"`);
        await queryRunner.query(`DROP TABLE "trees"`);
    }

}
