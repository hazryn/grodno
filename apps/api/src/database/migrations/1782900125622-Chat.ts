import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Czat / messenger: rozmowy 1:1 i grupowe, wiadomości (seq BIGSERIAL = kolejność+odczyty),
 * załączniki (MinIO), reakcje, cache tłumaczeń, subskrypcje web-push. Plus users.lastSeenAt
 * (obecność). Kolejność/odczyty opierają się na `seq`, nie na czasie. Unikalność 1:1 = częściowy
 * indeks unikalny na (treeId, directKey). FK z ON DELETE CASCADE tam, gdzie dzieci giną z rodzicem.
 */
export class Chat1782900125622 implements MigrationInterface {
  name = 'Chat1782900125622';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Obecność użytkownika (fallback; „online" jest w pamięci gateway'a).
    await queryRunner.query(`ALTER TABLE "users" ADD "lastSeenAt" TIMESTAMP WITH TIME ZONE`);

    // --- conversations ---
    await queryRunner.query(`
      CREATE TABLE "conversations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "treeId" uuid NOT NULL,
        "type" character varying NOT NULL DEFAULT 'direct',
        "title" character varying,
        "storageKey" character varying,
        "createdBy" uuid NOT NULL,
        "directKey" character varying,
        "lastMessageAt" TIMESTAMP WITH TIME ZONE,
        "lastMessageId" uuid,
        "lastMessagePreview" character varying(160),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_conversations" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_conversations_treeId" ON "conversations" ("treeId")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_conversations_lastMessageAt" ON "conversations" ("lastMessageAt")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_conversations_direct" ON "conversations" ("treeId", "directKey") WHERE "type" = 'direct' AND "directKey" IS NOT NULL`,
    );

    // --- conversation_participants ---
    await queryRunner.query(`
      CREATE TABLE "conversation_participants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversationId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "role" character varying NOT NULL DEFAULT 'member',
        "joinedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "leftAt" TIMESTAMP WITH TIME ZONE,
        "lastReadSeq" bigint NOT NULL DEFAULT 0,
        "lastReadMessageId" uuid,
        "lastReadAt" TIMESTAMP WITH TIME ZONE,
        "lastNotifiedAt" TIMESTAMP WITH TIME ZONE,
        "mutedUntil" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_conversation_participants" PRIMARY KEY ("id"),
        CONSTRAINT "FK_participants_conversation" FOREIGN KEY ("conversationId") REFERENCES "conversations" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_participants_user" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_participant_conv_user" ON "conversation_participants" ("conversationId", "userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_participants_userId" ON "conversation_participants" ("userId")`,
    );

    // --- messages (seq = BIGSERIAL, globalnie rosnący) ---
    await queryRunner.query(`
      CREATE TABLE "messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversationId" uuid NOT NULL,
        "seq" BIGSERIAL NOT NULL,
        "senderId" uuid,
        "type" character varying NOT NULL DEFAULT 'text',
        "body" text,
        "replyToId" uuid,
        "systemKind" character varying,
        "systemMeta" jsonb,
        "editedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        CONSTRAINT "PK_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_messages_conversation" FOREIGN KEY ("conversationId") REFERENCES "conversations" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_messages_conv_seq" ON "messages" ("conversationId", "seq")`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_messages_senderId" ON "messages" ("senderId")`);

    // --- message_attachments ---
    await queryRunner.query(`
      CREATE TABLE "message_attachments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "messageId" uuid,
        "conversationId" uuid NOT NULL,
        "uploadedBy" uuid NOT NULL,
        "storageKey" character varying NOT NULL,
        "mimeType" character varying NOT NULL,
        "width" integer,
        "height" integer,
        "size" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_message_attachments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_attachments_message" FOREIGN KEY ("messageId") REFERENCES "messages" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_attachments_conversation" FOREIGN KEY ("conversationId") REFERENCES "conversations" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_attachments_messageId" ON "message_attachments" ("messageId")`,
    );

    // --- message_reactions ---
    await queryRunner.query(`
      CREATE TABLE "message_reactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "messageId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "emoji" character varying(16) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_message_reactions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reactions_message" FOREIGN KEY ("messageId") REFERENCES "messages" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_reactions_user" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_reaction_msg_user_emoji" ON "message_reactions" ("messageId", "userId", "emoji")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reactions_messageId" ON "message_reactions" ("messageId")`,
    );

    // --- message_translations (cache) ---
    await queryRunner.query(`
      CREATE TABLE "message_translations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "messageId" uuid NOT NULL,
        "targetLocale" character varying NOT NULL,
        "sourceLocale" character varying,
        "sourceHash" character varying NOT NULL,
        "text" text NOT NULL,
        "provider" character varying,
        "model" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_message_translations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_translations_message" FOREIGN KEY ("messageId") REFERENCES "messages" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_translation_msg_locale" ON "message_translations" ("messageId", "targetLocale")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_translations_messageId" ON "message_translations" ("messageId")`,
    );

    // --- push_subscriptions ---
    await queryRunner.query(`
      CREATE TABLE "push_subscriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "endpoint" character varying NOT NULL,
        "p256dh" character varying NOT NULL,
        "auth" character varying NOT NULL,
        "userAgent" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "lastUsedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_push_subscriptions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_push_endpoint" UNIQUE ("endpoint"),
        CONSTRAINT "FK_push_user" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_push_userId" ON "push_subscriptions" ("userId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "push_subscriptions"`);
    await queryRunner.query(`DROP TABLE "message_translations"`);
    await queryRunner.query(`DROP TABLE "message_reactions"`);
    await queryRunner.query(`DROP TABLE "message_attachments"`);
    await queryRunner.query(`DROP TABLE "messages"`);
    await queryRunner.query(`DROP TABLE "conversation_participants"`);
    await queryRunner.query(`DROP TABLE "conversations"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "lastSeenAt"`);
  }
}
