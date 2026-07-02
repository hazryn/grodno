import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { User } from '../../database/entities';
import { MailService } from '../../mail/mail.service';

interface UnreadRow {
  participant_id: string;
  user_id: string;
  conversation_id: string;
}

/**
 * Cron: gdy najstarsza nieprzeczytana wiadomość leży ponad N dni, wysyła zlokalizowany
 * e-mail przypominający. Idempotencja przez `lastNotifiedAt` (`< oldest.createdAt` → ponów
 * tylko przy nowej nieprzeczytanej). Respektuje `mutedUntil` i `leftAt`.
 */
@Injectable()
export class UnreadDigestService {
  private readonly logger = new Logger(UnreadDigestService.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly mail: MailService,
  ) {}

  @Cron(process.env.UNREAD_NOTIFY_CRON ?? CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    if (process.env.UNREAD_NOTIFY_ENABLED === 'false') return;
    const days = Number.parseInt(process.env.UNREAD_NOTIFY_AFTER_DAYS ?? '3', 10);

    const rows: UnreadRow[] = await this.ds.query(
      `
      SELECT p."id" AS participant_id, p."userId" AS user_id, p."conversationId" AS conversation_id
      FROM "conversation_participants" p
      JOIN LATERAL (
        SELECT m."createdAt"
        FROM "messages" m
        WHERE m."conversationId" = p."conversationId"
          AND m."senderId" <> p."userId"
          AND m."deletedAt" IS NULL
          AND m."seq" > p."lastReadSeq"
        ORDER BY m."seq" ASC
        LIMIT 1
      ) ou ON true
      WHERE p."leftAt" IS NULL
        AND (p."mutedUntil" IS NULL OR p."mutedUntil" < now())
        AND ou."createdAt" < now() - ($1 || ' days')::interval
        AND (p."lastNotifiedAt" IS NULL OR p."lastNotifiedAt" < ou."createdAt")
      `,
      [days],
    );
    if (!rows.length) return;

    const byUser = new Map<string, { participantIds: string[]; conversations: Set<string> }>();
    for (const r of rows) {
      const g = byUser.get(r.user_id) ?? { participantIds: [], conversations: new Set<string>() };
      g.participantIds.push(r.participant_id);
      g.conversations.add(r.conversation_id);
      byUser.set(r.user_id, g);
    }

    const users = await this.ds.getRepository(User).findBy({ id: In([...byUser.keys()]) });
    const userById = new Map(users.map((u) => [u.id, u]));

    for (const [userId, group] of byUser) {
      const user = userById.get(userId);
      if (!user?.email) continue;
      try {
        await this.mail.sendUnreadDigest(user.email, user.locale, group.conversations.size);
        await this.ds.query(
          `UPDATE "conversation_participants" SET "lastNotifiedAt" = now() WHERE "id" = ANY($1)`,
          [group.participantIds],
        );
      } catch (err) {
        this.logger.warn(`Digest dla ${user.email} nieudany: ${(err as Error).message}`);
      }
    }
    this.logger.log(`Wysłano przypomnienia o nieprzeczytanych: ${byUser.size} użytkownik(ów).`);
  }
}
