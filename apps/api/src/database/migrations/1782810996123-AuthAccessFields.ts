import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Flow „poproś o dostęp" + logowanie hasłem: konto User staje się źródłem prawdy funnela.
 * passwordHash może być null (do onboardingu); isActive/emailVerified bramkują dostęp;
 * token/tokenType/tokenExpiresAt to jednorazowy slot na weryfikację maila i reset hasła.
 * Istniejące konta (np. seed admina) backfillujemy jako aktywne i zweryfikowane.
 */
export class AuthAccessFields1782810996123 implements MigrationInterface {
    name = 'AuthAccessFields1782810996123'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" ADD "firstName" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "lastName" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "isActive" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "users" ADD "emailVerified" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "users" ADD "token" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "tokenType" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "tokenExpiresAt" TIMESTAMP WITH TIME ZONE`);
        // Backfill: dotychczasowe konta (admin z seeda) mają mieć pełen dostęp.
        await queryRunner.query(`UPDATE "users" SET "isActive" = true, "emailVerified" = true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "tokenExpiresAt"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "tokenType"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "token"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "emailVerified"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isActive"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "lastName"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "firstName"`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "passwordHash" SET NOT NULL`);
    }
}
