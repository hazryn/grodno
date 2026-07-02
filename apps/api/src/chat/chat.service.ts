import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import type {
  ChatAttachmentDto,
  ChatContact,
  ChatMessageDto,
  ChatParticipant,
  ChatReactionDto,
  ChatTranslationDto,
  ConversationDto,
  Locale,
  ReadReceiptPayload,
} from '@rodno/shared';
import { normalizeLocale } from '@rodno/shared';
import {
  TRANSLATION_PROVIDER,
  type TranslationProvider,
} from './translation/translation-provider.interface';
import {
  Conversation,
  ConversationParticipant,
  Individual,
  Message,
  MessageAttachment,
  MessageReaction,
  MessageTranslation,
  User,
} from '../database/entities';
import { MediaService } from '../media/media.service';
import { PresenceService } from './presence.service';
import { ChatBus } from './chat-bus';
import type { JwtUser } from '../auth/current-user.decorator';

/** Kontekst zalogowanego rozmówcy: konto + osoba + drzewo. */
interface ChatContext {
  userId: string;
  individualId: string;
  treeId: string;
  locale: Locale;
}

export interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

const ALLOWED_IMAGE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/heic': 'heic',
};

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly maxAttachmentBytes =
    Number.parseInt(process.env.CHAT_MAX_ATTACHMENT_MB ?? '10', 10) * 1024 * 1024;
  private readonly maxTranslateChars = Number.parseInt(
    process.env.TRANSLATE_MAX_CHARS ?? '4000',
    10,
  );

  constructor(
    @InjectRepository(Conversation) private readonly convRepo: Repository<Conversation>,
    @InjectRepository(ConversationParticipant)
    private readonly partRepo: Repository<ConversationParticipant>,
    @InjectRepository(Message) private readonly msgRepo: Repository<Message>,
    @InjectRepository(MessageAttachment)
    private readonly attRepo: Repository<MessageAttachment>,
    @InjectRepository(MessageReaction) private readonly reactRepo: Repository<MessageReaction>,
    @InjectRepository(MessageTranslation)
    private readonly translationRepo: Repository<MessageTranslation>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Individual) private readonly indiRepo: Repository<Individual>,
    @Inject(TRANSLATION_PROVIDER) private readonly translator: TranslationProvider,
    private readonly media: MediaService,
    private readonly presence: PresenceService,
    private readonly bus: ChatBus,
  ) {}

  /* --------------------------------- kontekst / authz --------------------------------- */

  private async context(me: JwtUser): Promise<ChatContext> {
    if (!me?.individualId) {
      throw new ForbiddenException('Konto nie jest powiązane z osobą w drzewie.');
    }
    const indi = await this.indiRepo.findOne({ where: { id: me.individualId } });
    if (!indi) throw new ForbiddenException('Osoba przypisana do konta nie istnieje.');
    return {
      userId: me.sub,
      individualId: me.individualId,
      treeId: indi.treeId,
      locale: normalizeLocale(me.locale),
    };
  }

  private async loadConvInTree(conversationId: string, treeId: string): Promise<Conversation> {
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('Rozmowa nie istnieje.');
    if (conv.treeId !== treeId) throw new ForbiddenException('Brak dostępu do rozmowy.');
    return conv;
  }

  private async assertParticipant(
    conversationId: string,
    userId: string,
  ): Promise<ConversationParticipant> {
    const p = await this.partRepo.findOne({
      where: { conversationId, userId, leftAt: IsNull() },
    });
    if (!p) throw new ForbiddenException('Nie jesteś uczestnikiem tej rozmowy.');
    return p;
  }

  private assertAdmin(p: ConversationParticipant): void {
    if (p.role !== 'admin') throw new ForbiddenException('Wymagane uprawnienia administratora grupy.');
  }

  /** Publiczne dla gateway'a: czy user jest aktywnym uczestnikiem (do conv:join). */
  async isParticipant(conversationId: string, userId: string): Promise<boolean> {
    const c = await this.partRepo.count({
      where: { conversationId, userId, leftAt: IsNull() },
    });
    return c > 0;
  }

  /** Aktywni uczestnicy rozmowy (userId) — do broadcastu/push. */
  async participantUserIds(conversationId: string): Promise<string[]> {
    const rows = await this.partRepo.find({
      where: { conversationId, leftAt: IsNull() },
      select: ['userId'],
    });
    return rows.map((r) => r.userId);
  }

  /** Osoby współdzielące ze mną jakąkolwiek rozmowę — komu rozgłaszać moją obecność. */
  async coParticipantUserIds(userId: string): Promise<string[]> {
    const mine = await this.partRepo.find({
      where: { userId, leftAt: IsNull() },
      select: ['conversationId'],
    });
    const convIds = mine.map((p) => p.conversationId);
    if (!convIds.length) return [];
    const others = await this.partRepo.find({
      where: { conversationId: In(convIds), leftAt: IsNull() },
      select: ['userId'],
    });
    const set = new Set(others.map((o) => o.userId));
    set.delete(userId);
    return [...set];
  }

  /* --------------------------------- kontakty --------------------------------- */

  async listContacts(me: JwtUser): Promise<ChatContact[]> {
    const ctx = await this.context(me);
    const living = await this.indiRepo.find({
      where: { treeId: ctx.treeId, isLiving: true },
      select: ['id', 'photoUrl', 'sex'],
    });
    if (!living.length) return [];
    const byIndi = new Map(living.map((i) => [i.id, i]));
    const users = await this.userRepo.find({
      where: { isActive: true, individualId: In([...byIndi.keys()]) },
    });
    return users
      .filter((u) => u.id !== ctx.userId && u.individualId)
      .map((u) => {
        const indi = byIndi.get(u.individualId as string);
        return {
          userId: u.id,
          individualId: u.individualId,
          displayName: u.displayName,
          photoUrl: this.media.presign(indi?.photoUrl),
          sex: indi?.sex ?? 'U',
          online: this.presence.isOnline(u.id),
          lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  /* --------------------------------- rozmowy --------------------------------- */

  async listConversations(me: JwtUser): Promise<ConversationDto[]> {
    const ctx = await this.context(me);
    const myParts = await this.partRepo.find({
      where: { userId: ctx.userId, leftAt: IsNull() },
      select: ['conversationId'],
    });
    const convIds = myParts.map((p) => p.conversationId);
    if (!convIds.length) return [];
    const convs = await this.convRepo.find({ where: { id: In(convIds) } });
    const dtos = await Promise.all(convs.map((c) => this.toConversationDto(c, ctx.userId)));
    return dtos.sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));
  }

  async getConversation(me: JwtUser, conversationId: string): Promise<ConversationDto> {
    const ctx = await this.context(me);
    const conv = await this.loadConvInTree(conversationId, ctx.treeId);
    await this.assertParticipant(conversationId, ctx.userId);
    return this.toConversationDto(conv, ctx.userId);
  }

  async getOrCreateDirect(me: JwtUser, otherUserId: string): Promise<ConversationDto> {
    const ctx = await this.context(me);
    if (otherUserId === ctx.userId) throw new BadRequestException('Nie można pisać do siebie.');
    const other = await this.userRepo.findOne({ where: { id: otherUserId } });
    if (!other || !other.isActive || !other.individualId) {
      throw new NotFoundException('Odbiorca jest niedostępny.');
    }
    const otherIndi = await this.indiRepo.findOne({ where: { id: other.individualId } });
    if (!otherIndi || otherIndi.treeId !== ctx.treeId || !otherIndi.isLiving) {
      throw new ForbiddenException('Osoba spoza drzewa lub niedostępna.');
    }
    const directKey = [ctx.userId, otherUserId].sort().join(':');
    let conv = await this.convRepo.findOne({
      where: { treeId: ctx.treeId, type: 'direct', directKey },
    });
    if (!conv) {
      try {
        conv = await this.convRepo.save(
          this.convRepo.create({
            treeId: ctx.treeId,
            type: 'direct',
            directKey,
            createdBy: ctx.userId,
          }),
        );
        await this.partRepo.save([
          this.partRepo.create({ conversationId: conv.id, userId: ctx.userId, role: 'member' }),
          this.partRepo.create({ conversationId: conv.id, userId: otherUserId, role: 'member' }),
        ]);
      } catch (err) {
        if (this.isUniqueViolation(err)) {
          conv = await this.convRepo.findOneOrFail({
            where: { treeId: ctx.treeId, type: 'direct', directKey },
          });
        } else {
          throw err;
        }
      }
    }
    return this.toConversationDto(conv, ctx.userId);
  }

  async createGroup(me: JwtUser, title: string, userIds: string[]): Promise<ConversationDto> {
    const ctx = await this.context(me);
    const ids = [...new Set(userIds.filter((id) => id !== ctx.userId))];
    if (!ids.length) throw new BadRequestException('Grupa potrzebuje przynajmniej jednego uczestnika.');
    await this.assertUsersInTree(ids, ctx.treeId);

    const conv = await this.convRepo.save(
      this.convRepo.create({
        treeId: ctx.treeId,
        type: 'group',
        title: title.trim(),
        createdBy: ctx.userId,
      }),
    );
    await this.partRepo.save([
      this.partRepo.create({ conversationId: conv.id, userId: ctx.userId, role: 'admin' }),
      ...ids.map((uid) =>
        this.partRepo.create({ conversationId: conv.id, userId: uid, role: 'member' }),
      ),
    ]);
    await this.addSystemMessage(conv.id, 'group.created', { by: ctx.userId, title: conv.title });
    this.bus.emitConversationUpdated({
      participantUserIds: [ctx.userId, ...ids],
      payload: { conversationId: conv.id, lastMessagePreview: null, lastMessageAt: null },
    });
    return this.toConversationDto(conv, ctx.userId);
  }

  async renameGroup(me: JwtUser, conversationId: string, title: string): Promise<ConversationDto> {
    const ctx = await this.context(me);
    const conv = await this.loadConvInTree(conversationId, ctx.treeId);
    if (conv.type !== 'group') throw new BadRequestException('To nie jest grupa.');
    this.assertAdmin(await this.assertParticipant(conversationId, ctx.userId));
    conv.title = title.trim();
    await this.convRepo.save(conv);
    await this.addSystemMessage(conversationId, 'group.renamed', { by: ctx.userId, title: conv.title });
    this.bus.emitConversationUpdated({
      participantUserIds: await this.participantUserIds(conversationId),
      payload: {
        conversationId,
        lastMessagePreview: conv.lastMessagePreview,
        lastMessageAt: conv.lastMessageAt?.toISOString() ?? null,
      },
    });
    return this.toConversationDto(conv, ctx.userId);
  }

  async addParticipants(
    me: JwtUser,
    conversationId: string,
    userIds: string[],
  ): Promise<ConversationDto> {
    const ctx = await this.context(me);
    const conv = await this.loadConvInTree(conversationId, ctx.treeId);
    if (conv.type !== 'group') throw new BadRequestException('To nie jest grupa.');
    this.assertAdmin(await this.assertParticipant(conversationId, ctx.userId));
    const ids = [...new Set(userIds.filter((id) => id !== ctx.userId))];
    await this.assertUsersInTree(ids, ctx.treeId);
    for (const uid of ids) {
      const existing = await this.partRepo.findOne({ where: { conversationId, userId: uid } });
      if (existing) {
        if (existing.leftAt) {
          existing.leftAt = null;
          await this.partRepo.save(existing);
        }
      } else {
        await this.partRepo.save(
          this.partRepo.create({ conversationId, userId: uid, role: 'member' }),
        );
      }
    }
    await this.addSystemMessage(conversationId, 'member.added', { by: ctx.userId, added: ids });
    this.bus.emitConversationUpdated({
      participantUserIds: await this.participantUserIds(conversationId),
      payload: {
        conversationId,
        lastMessagePreview: conv.lastMessagePreview,
        lastMessageAt: conv.lastMessageAt?.toISOString() ?? null,
      },
    });
    return this.toConversationDto(conv, ctx.userId);
  }

  async removeParticipant(
    me: JwtUser,
    conversationId: string,
    userId: string,
  ): Promise<void> {
    const ctx = await this.context(me);
    const conv = await this.loadConvInTree(conversationId, ctx.treeId);
    if (conv.type !== 'group') throw new BadRequestException('To nie jest grupa.');
    const mine = await this.assertParticipant(conversationId, ctx.userId);
    const isSelf = userId === ctx.userId;
    if (!isSelf) this.assertAdmin(mine);
    const target = await this.partRepo.findOne({
      where: { conversationId, userId, leftAt: IsNull() },
    });
    if (!target) return;
    target.leftAt = new Date();
    await this.partRepo.save(target);
    await this.addSystemMessage(conversationId, isSelf ? 'member.left' : 'member.removed', {
      by: ctx.userId,
      target: userId,
    });
    this.bus.emitConversationUpdated({
      participantUserIds: [...(await this.participantUserIds(conversationId)), userId],
      payload: {
        conversationId,
        lastMessagePreview: conv.lastMessagePreview,
        lastMessageAt: conv.lastMessageAt?.toISOString() ?? null,
      },
    });
  }

  async uploadGroupAvatar(
    me: JwtUser,
    conversationId: string,
    file: UploadedFile,
  ): Promise<ConversationDto> {
    const ctx = await this.context(me);
    const conv = await this.loadConvInTree(conversationId, ctx.treeId);
    if (conv.type !== 'group') throw new BadRequestException('To nie jest grupa.');
    this.assertAdmin(await this.assertParticipant(conversationId, ctx.userId));
    this.assertImage(file);
    const prev = conv.storageKey;
    const key = `chat/${conversationId}/avatar-${randomUUID()}.${ALLOWED_IMAGE[file.mimetype]}`;
    await this.media.putObject(key, file.buffer, file.mimetype);
    conv.storageKey = key;
    await this.convRepo.save(conv);
    if (prev) await this.media.deleteObject(prev).catch(() => undefined);
    return this.toConversationDto(conv, ctx.userId);
  }

  /* --------------------------------- wiadomości --------------------------------- */

  async listMessages(
    me: JwtUser,
    conversationId: string,
    before: string | undefined,
    limit: number,
  ): Promise<ChatMessageDto[]> {
    const ctx = await this.context(me);
    await this.loadConvInTree(conversationId, ctx.treeId);
    await this.assertParticipant(conversationId, ctx.userId);
    const take = Math.min(Math.max(limit, 1), 50);
    const qb = this.msgRepo
      .createQueryBuilder('m')
      .withDeleted()
      .where('m.conversationId = :c', { c: conversationId })
      .orderBy('m.seq', 'DESC')
      .take(take);
    if (before) qb.andWhere('m.seq < :before', { before });
    const rows = await qb.getMany();
    const dtos = await this.toMessageDtos(rows, ctx.userId);
    return dtos.reverse();
  }

  async sendMessage(
    me: JwtUser,
    conversationId: string,
    input: { body?: string; replyToId?: string | null; attachmentIds?: string[] },
  ): Promise<ChatMessageDto> {
    const ctx = await this.context(me);
    const conv = await this.loadConvInTree(conversationId, ctx.treeId);
    await this.assertParticipant(conversationId, ctx.userId);

    const body = input.body?.trim() || null;
    const attachmentIds = input.attachmentIds ?? [];
    if (!body && attachmentIds.length === 0) throw new BadRequestException('Pusta wiadomość.');

    const msg = await this.msgRepo.save(
      this.msgRepo.create({
        conversationId,
        senderId: ctx.userId,
        type: attachmentIds.length ? 'image' : 'text',
        body,
        replyToId: input.replyToId ?? null,
      }),
    );

    let claimed: MessageAttachment[] = [];
    if (attachmentIds.length) {
      await this.attRepo
        .createQueryBuilder()
        .update()
        .set({ messageId: msg.id })
        .where(
          'id IN (:...ids) AND uploadedBy = :me AND conversationId = :conv AND messageId IS NULL',
          { ids: attachmentIds, me: ctx.userId, conv: conversationId },
        )
        .execute();
      claimed = await this.attRepo.find({ where: { messageId: msg.id } });
    }

    const preview = this.preview(body, claimed.length > 0);
    conv.lastMessageId = msg.id;
    conv.lastMessageAt = msg.createdAt;
    conv.lastMessagePreview = preview;
    await this.convRepo.save(conv);

    const dto = this.toMessageDto(msg, claimed, [], ctx.userId);
    const participantIds = await this.participantUserIds(conversationId);
    this.bus.emitMessageNew({
      conversationId,
      message: dto,
      recipientUserIds: participantIds.filter((id) => id !== ctx.userId),
    });
    this.bus.emitConversationUpdated({
      participantUserIds: participantIds,
      payload: {
        conversationId,
        lastMessagePreview: preview,
        lastMessageAt: msg.createdAt.toISOString(),
      },
    });
    return dto;
  }

  async editMessage(me: JwtUser, messageId: string, body: string): Promise<ChatMessageDto> {
    const ctx = await this.context(me);
    const msg = await this.msgRepo.findOne({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Wiadomość nie istnieje.');
    if (msg.senderId !== ctx.userId) throw new ForbiddenException('Można edytować tylko własne wiadomości.');
    await this.assertParticipant(msg.conversationId, ctx.userId);
    msg.body = body.trim();
    msg.editedAt = new Date();
    await this.msgRepo.save(msg);
    // Edycja unieważnia cache tłumaczeń (zbuduje się na nowo na żądanie).
    await this.translationRepo.delete({ messageId });
    const dto = await this.oneMessageDto(msg, ctx.userId);
    this.bus.emitMessageEdited({ conversationId: msg.conversationId, message: dto });
    await this.refreshPreviewIfLast(msg.conversationId, msg.id, dto);
    return dto;
  }

  async deleteMessage(me: JwtUser, messageId: string): Promise<void> {
    const ctx = await this.context(me);
    const msg = await this.msgRepo.findOne({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Wiadomość nie istnieje.');
    const mine = await this.assertParticipant(msg.conversationId, ctx.userId);
    if (msg.senderId !== ctx.userId && mine.role !== 'admin') {
      throw new ForbiddenException('Brak uprawnień do usunięcia wiadomości.');
    }
    const atts = await this.attRepo.find({ where: { messageId } });
    for (const a of atts) await this.media.deleteObject(a.storageKey).catch(() => undefined);
    await this.attRepo.delete({ messageId });
    await this.reactRepo.delete({ messageId });
    await this.translationRepo.delete({ messageId });
    msg.body = null;
    await this.msgRepo.save(msg);
    await this.msgRepo.softDelete(messageId);
    this.bus.emitMessageDeleted({ conversationId: msg.conversationId, messageId });
  }

  async react(me: JwtUser, messageId: string, emoji: string, add: boolean): Promise<void> {
    const ctx = await this.context(me);
    const msg = await this.msgRepo.findOne({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Wiadomość nie istnieje.');
    await this.assertParticipant(msg.conversationId, ctx.userId);
    if (add) {
      await this.reactRepo
        .createQueryBuilder()
        .insert()
        .values({ messageId, userId: ctx.userId, emoji })
        .orIgnore()
        .execute();
    } else {
      await this.reactRepo.delete({ messageId, userId: ctx.userId, emoji });
    }
    this.bus.emitReaction({
      messageId,
      conversationId: msg.conversationId,
      emoji,
      userId: ctx.userId,
      op: add ? 'add' : 'remove',
    });
  }

  async markRead(
    me: JwtUser,
    conversationId: string,
    messageId: string,
  ): Promise<ReadReceiptPayload> {
    const ctx = await this.context(me);
    const participant = await this.assertParticipant(conversationId, ctx.userId);
    const msg = await this.msgRepo.findOne({
      where: { id: messageId, conversationId },
      withDeleted: true,
    });
    if (!msg) throw new NotFoundException('Wiadomość nie istnieje.');
    await this.partRepo.query(
      `UPDATE "conversation_participants"
         SET "lastReadSeq" = GREATEST("lastReadSeq", $1),
             "lastReadMessageId" = $2,
             "lastReadAt" = now()
       WHERE "id" = $3`,
      [msg.seq, messageId, participant.id],
    );
    const payload: ReadReceiptPayload = {
      conversationId,
      userId: ctx.userId,
      lastReadSeq: Number(msg.seq),
      lastReadMessageId: messageId,
      lastReadAt: new Date().toISOString(),
    };
    this.bus.emitReadReceipt(payload);
    return payload;
  }

  /* --------------------------------- załączniki --------------------------------- */

  async uploadAttachments(
    me: JwtUser,
    conversationId: string,
    files: UploadedFile[],
  ): Promise<ChatAttachmentDto[]> {
    const ctx = await this.context(me);
    await this.loadConvInTree(conversationId, ctx.treeId);
    await this.assertParticipant(conversationId, ctx.userId);
    const out: ChatAttachmentDto[] = [];
    for (const file of files ?? []) {
      this.assertImage(file);
      const key = `chat/${conversationId}/${randomUUID()}.${ALLOWED_IMAGE[file.mimetype]}`;
      await this.media.putObject(key, file.buffer, file.mimetype);
      const row = await this.attRepo.save(
        this.attRepo.create({
          conversationId,
          uploadedBy: ctx.userId,
          storageKey: key,
          mimeType: file.mimetype,
          size: file.buffer.length,
        }),
      );
      out.push({
        id: row.id,
        url: this.media.presign(key),
        mimeType: file.mimetype,
        width: null,
        height: null,
      });
    }
    return out;
  }

  /* --------------------------------- tłumaczenia --------------------------------- */

  async translateMessage(
    me: JwtUser,
    messageId: string,
    targetLocaleInput?: string,
  ): Promise<ChatTranslationDto> {
    const ctx = await this.context(me);
    const msg = await this.msgRepo.findOne({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Wiadomość nie istnieje.');
    await this.assertParticipant(msg.conversationId, ctx.userId);

    const target = normalizeLocale(targetLocaleInput ?? ctx.locale);
    const text = msg.body?.trim() ?? '';
    const fallback = (translated: boolean): ChatTranslationDto => ({
      messageId,
      targetLocale: target,
      text,
      translated,
      sourceLocale: null,
    });
    if (!text) return fallback(false);
    if (process.env.TRANSLATE_ENABLED === 'false') return fallback(false);
    if (text.length > this.maxTranslateChars) return fallback(false);

    const sourceHash = createHash('sha256').update(text).digest('hex');
    const cached = await this.translationRepo.findOne({
      where: { messageId, targetLocale: target },
    });
    if (cached && cached.sourceHash === sourceHash) {
      return {
        messageId,
        targetLocale: target,
        text: cached.text,
        translated: true,
        sourceLocale: cached.sourceLocale,
      };
    }
    try {
      const result = await this.translator.translate({ text, targetLocale: target });
      const outText = result.text.trim() || text;
      if (cached) {
        cached.text = outText;
        cached.sourceHash = sourceHash;
        cached.sourceLocale = result.sourceLocale ?? null;
        cached.model = result.model;
        cached.provider = 'openai-compatible';
        await this.translationRepo.save(cached);
      } else {
        await this.translationRepo
          .createQueryBuilder()
          .insert()
          .values({
            messageId,
            targetLocale: target,
            sourceHash,
            text: outText,
            sourceLocale: result.sourceLocale ?? null,
            model: result.model,
            provider: 'openai-compatible',
          })
          .orIgnore()
          .execute();
      }
      return {
        messageId,
        targetLocale: target,
        text: outText,
        translated: true,
        sourceLocale: result.sourceLocale ?? null,
      };
    } catch (err) {
      this.logger.warn(`Tłumaczenie ${messageId}→${target} nieudane: ${(err as Error).message}`);
      return fallback(false);
    }
  }

  /* --------------------------------- budowanie DTO --------------------------------- */

  private async toConversationDto(conv: Conversation, meId: string): Promise<ConversationDto> {
    const participants = await this.buildParticipants(conv.id, meId);
    const me = participants.find((p) => p.userId === meId);
    const lastMsg = conv.lastMessageId
      ? await this.msgRepo.findOne({ where: { id: conv.lastMessageId }, withDeleted: true })
      : null;
    const lastDto = lastMsg ? await this.oneMessageDto(lastMsg, meId) : null;
    const unread = me ? await this.unreadCount(conv.id, meId, me.lastReadSeq) : 0;
    return {
      id: conv.id,
      type: conv.type,
      title: conv.title,
      photoUrl: conv.type === 'group' ? this.media.presign(conv.storageKey) : null,
      participants,
      lastMessage: lastDto,
      lastMessageAt: conv.lastMessageAt?.toISOString() ?? null,
      unreadCount: unread,
      createdAt: conv.createdAt.toISOString(),
    };
  }

  private async buildParticipants(
    conversationId: string,
    meId: string,
  ): Promise<ChatParticipant[]> {
    const parts = await this.partRepo.find({
      where: { conversationId, leftAt: IsNull() },
    });
    const userIds = parts.map((p) => p.userId);
    const users = userIds.length ? await this.userRepo.find({ where: { id: In(userIds) } }) : [];
    const userById = new Map(users.map((u) => [u.id, u]));
    const indiIds = users.map((u) => u.individualId).filter((x): x is string => !!x);
    const indis = indiIds.length ? await this.indiRepo.find({ where: { id: In(indiIds) } }) : [];
    const indiById = new Map(indis.map((i) => [i.id, i]));
    return parts.map((p) => {
      const u = userById.get(p.userId);
      const indi = u?.individualId ? indiById.get(u.individualId) : null;
      return {
        userId: p.userId,
        individualId: u?.individualId ?? null,
        displayName: u?.displayName ?? '—',
        photoUrl: this.media.presign(indi?.photoUrl),
        sex: indi?.sex ?? 'U',
        role: p.role,
        online: this.presence.isOnline(p.userId),
        lastSeenAt: u?.lastSeenAt?.toISOString() ?? null,
        lastReadSeq: Number(p.lastReadSeq),
      };
    });
  }

  private async unreadCount(
    conversationId: string,
    meId: string,
    lastReadSeq: number,
  ): Promise<number> {
    const raw = await this.msgRepo
      .createQueryBuilder('m')
      .select('COUNT(*)', 'cnt')
      .where('m.conversationId = :c', { c: conversationId })
      .andWhere('m.seq > :s', { s: lastReadSeq })
      .andWhere('m.senderId != :me', { me: meId })
      .getRawOne<{ cnt: string }>();
    return Number(raw?.cnt ?? 0);
  }

  private async toMessageDtos(messages: Message[], meId: string): Promise<ChatMessageDto[]> {
    const ids = messages.map((m) => m.id);
    const [attachments, reactions] = await Promise.all([
      ids.length ? this.attRepo.find({ where: { messageId: In(ids) } }) : [],
      ids.length ? this.reactRepo.find({ where: { messageId: In(ids) } }) : [],
    ]);
    const attByMsg = this.groupBy(attachments, (a) => a.messageId as string);
    const reByMsg = this.groupBy(reactions, (r) => r.messageId);
    return messages.map((m) =>
      this.toMessageDto(m, attByMsg.get(m.id) ?? [], reByMsg.get(m.id) ?? [], meId),
    );
  }

  private async oneMessageDto(msg: Message, meId: string): Promise<ChatMessageDto> {
    const [attachments, reactions] = await Promise.all([
      this.attRepo.find({ where: { messageId: msg.id } }),
      this.reactRepo.find({ where: { messageId: msg.id } }),
    ]);
    return this.toMessageDto(msg, attachments, reactions, meId);
  }

  private toMessageDto(
    m: Message,
    atts: MessageAttachment[],
    reacts: MessageReaction[],
    meId: string,
  ): ChatMessageDto {
    const deleted = !!m.deletedAt;
    return {
      id: m.id,
      conversationId: m.conversationId,
      seq: Number(m.seq),
      senderId: m.senderId,
      type: m.type,
      body: deleted ? null : m.body,
      replyToId: m.replyToId,
      systemKind: m.systemKind,
      systemMeta: m.systemMeta,
      attachments: deleted
        ? []
        : atts.map((a) => ({
            id: a.id,
            url: this.media.presign(a.storageKey),
            mimeType: a.mimeType,
            width: a.width,
            height: a.height,
          })),
      reactions: deleted ? [] : this.aggregateReactions(reacts, meId),
      editedAt: m.editedAt?.toISOString() ?? null,
      deletedAt: m.deletedAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
    };
  }

  private aggregateReactions(reacts: MessageReaction[], meId: string): ChatReactionDto[] {
    const byEmoji = this.groupBy(reacts, (r) => r.emoji);
    return [...byEmoji.entries()].map(([emoji, list]) => ({
      emoji,
      count: list.length,
      userIds: list.map((r) => r.userId),
      mine: list.some((r) => r.userId === meId),
    }));
  }

  /* --------------------------------- helpery --------------------------------- */

  private async addSystemMessage(
    conversationId: string,
    kind: string,
    meta: Record<string, unknown>,
  ): Promise<void> {
    await this.msgRepo.save(
      this.msgRepo.create({
        conversationId,
        senderId: null,
        type: 'system',
        systemKind: kind,
        systemMeta: meta,
      }),
    );
  }

  private async refreshPreviewIfLast(
    conversationId: string,
    messageId: string,
    dto: ChatMessageDto,
  ): Promise<void> {
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (conv && conv.lastMessageId === messageId) {
      conv.lastMessagePreview = this.preview(dto.body, dto.attachments.length > 0);
      await this.convRepo.save(conv);
    }
  }

  private async assertUsersInTree(userIds: string[], treeId: string): Promise<void> {
    if (!userIds.length) return;
    const users = await this.userRepo.find({ where: { id: In(userIds), isActive: true } });
    if (users.length !== userIds.length) {
      throw new BadRequestException('Część osób jest niedostępna lub nieaktywna.');
    }
    const indiIds = users.map((u) => u.individualId).filter((x): x is string => !!x);
    const indis = indiIds.length ? await this.indiRepo.find({ where: { id: In(indiIds) } }) : [];
    const ok = new Set(indis.filter((i) => i.treeId === treeId && i.isLiving).map((i) => i.id));
    for (const u of users) {
      if (!u.individualId || !ok.has(u.individualId)) {
        throw new BadRequestException('Można pisać tylko do żyjących osób z Twojego drzewa.');
      }
    }
  }

  private assertImage(file: UploadedFile): void {
    if (!file || !ALLOWED_IMAGE[file.mimetype]) {
      throw new BadRequestException('Nieobsługiwany format pliku (dozwolone obrazy).');
    }
    if (file.buffer.length > this.maxAttachmentBytes) {
      throw new BadRequestException('Plik jest za duży.');
    }
  }

  private preview(body: string | null, hasAttachments: boolean): string | null {
    if (body) return body.length > 160 ? `${body.slice(0, 157)}…` : body;
    if (hasAttachments) return null;
    return null;
  }

  private groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
    const map = new Map<K, T[]>();
    for (const item of items) {
      const k = key(item);
      const arr = map.get(k);
      if (arr) arr.push(item);
      else map.set(k, [item]);
    }
    return map;
  }

  private isUniqueViolation(err: unknown): boolean {
    const e = err as { code?: string; driverError?: { code?: string } };
    return e?.code === '23505' || e?.driverError?.code === '23505';
  }
}
