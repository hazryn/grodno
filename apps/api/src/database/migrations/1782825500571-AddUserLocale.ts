import { MigrationInterface, QueryRunner } from "typeorm";

/** Preferowany język użytkownika (interfejs + maile). Domyślnie i dla istniejących kont: pl. */
export class AddUserLocale1782825500571 implements MigrationInterface {
    name = 'AddUserLocale1782825500571'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "locale" character varying NOT NULL DEFAULT 'pl'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "locale"`);
    }
}
