import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as webpush from 'web-push';
import type { ChatMessageDto } from '@rodno/shared';
import { Conversation, PushSubscription, User } from '../../database/entities';
import { normalizeMailLocale, type MailLocale } from '../../mail/i18n';

const PHOTO_LABEL: Record<MailLocale, string> = {
  pl: '📷 Zdjęcie',
  en: '📷 Photo',
  de: '📷 Foto',
};

interface SubscribeInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}

/**
 * Web Push (VAPID). Wysyłka gdy okno/rozmowa nieaktywne (decyzję o „nie ogląda" podejmuje
 * gateway). Bez kluczy VAPID / PUSH_ENABLED=false → wyłączony (log, jak MailService w dev).
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly enabled: boolean;

  constructor(
    @InjectRepository(PushSubscription) private readonly subRepo: Repository<PushSubscription>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Conversation) private readonly convRepo: Repository<Conversation>,
  ) {
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    if (process.env.PUSH_ENABLED !== 'false' && pub && priv) {
      webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:admin@rodno.local', pub, priv);
      this.enabled = true;
    } else {
      this.enabled = false;
      this.logger.log('Web push wyłączony (brak VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY lub PUSH_ENABLED=false).');
    }
  }

  async subscribe(userId: string, dto: SubscribeInput): Promise<void> {
    const existing = await this.subRepo.findOne({ where: { endpoint: dto.endpoint } });
    if (existing) {
      existing.userId = userId;
      existing.p256dh = dto.keys.p256dh;
      existing.auth = dto.keys.auth;
      existing.userAgent = dto.userAgent ?? null;
      existing.lastUsedAt = new Date();
      await this.subRepo.save(existing);
      return;
    }
    await this.subRepo.save(
      this.subRepo.create({
        userId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: dto.userAgent ?? null,
      }),
    );
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.subRepo.delete({ userId, endpoint });
  }

  /** Powiadamia offline'owych odbiorców o nowej wiadomości. */
  async notifyNewMessage(userIds: string[], message: ChatMessageDto): Promise<void> {
    if (!this.enabled || !userIds.length) return;
    const subs = await this.subRepo.find({ where: { userId: In(userIds) } });
    if (!subs.length) return;

    const conv = await this.convRepo.findOne({ where: { id: message.conversationId } });
    const sender = message.senderId
      ? await this.userRepo.findOne({ where: { id: message.senderId } })
      : null;
    const recipients = await this.userRepo.find({ where: { id: In(userIds) } });
    const localeByUser = new Map(recipients.map((u) => [u.id, normalizeMailLocale(u.locale)]));
    const webBase = (process.env.APP_PUBLIC_URL ?? 'http://localhost:5200').replace(/\/$/, '');
    const senderName = sender?.displayName ?? 'Rodno';
    const isGroup = conv?.type === 'group';

    await Promise.all(
      subs.map(async (sub) => {
        const locale = localeByUser.get(sub.userId) ?? 'pl';
        const bodyText =
          message.body?.trim() || (message.type === 'image' ? PHOTO_LABEL[locale] : '');
        const payload = JSON.stringify({
          title: isGroup ? conv?.title ?? 'Rodno' : senderName,
          body: isGroup ? `${senderName}: ${bodyText}` : bodyText,
          url: `${webBase}/${locale}/chat`,
          conversationId: message.conversationId,
        });
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) {
            await this.subRepo.delete({ id: sub.id });
          } else {
            this.logger.warn(`Push do ${sub.userId} nieudany: ${(err as Error).message}`);
          }
        }
      }),
    );
  }
}
