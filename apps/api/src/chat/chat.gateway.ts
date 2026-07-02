import { Logger, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { PresencePayload } from '@rodno/shared';
import { UsersService } from '../auth/users.service';
import type { JwtUser } from '../auth/current-user.decorator';
import { ChatService } from './chat.service';
import { PresenceService } from './presence.service';
import { ChatBus, type MessageNewEvent } from './chat-bus';
import { PushService } from './notifications/push.service';

interface SocketData {
  jwtUser: JwtUser;
  userId: string;
}

const OFFLINE_DEBOUNCE_MS = 8000;

/**
 * Bramka Socket.IO czatu (namespace /chat). Uwierzytelnienie JWT w handshake; tożsamość
 * zawsze z `socket.data`, nigdy z payloadu zdarzenia (blokuje podszywanie). Pokoje:
 * `user:<id>` (per konto, multi-device) + `conv:<id>` (dołączane po otwarciu rozmowy).
 * Broadcasty domenowe idą przez ChatBus (publikuje ChatService).
 */
@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: (process.env.WEB_ORIGIN ?? 'http://localhost:5200').split(','),
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatGateway.name);
  private readonly offlineTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    private readonly chat: ChatService,
    private readonly presence: PresenceService,
    private readonly bus: ChatBus,
    private readonly push: PushService,
  ) {}

  /* --------------------------- broadcast z szyny domenowej --------------------------- */

  onModuleInit(): void {
    this.bus.onMessageNew((e) => {
      this.server?.to(`conv:${e.conversationId}`).emit('message:new', e.message);
      void this.pushOffline(e);
    });
    this.bus.onMessageEdited((e) => {
      this.server?.to(`conv:${e.conversationId}`).emit('message:edited', e.message);
    });
    this.bus.onMessageDeleted((e) => {
      this.server?.to(`conv:${e.conversationId}`).emit('message:deleted', {
        conversationId: e.conversationId,
        messageId: e.messageId,
      });
    });
    this.bus.onReaction((e) => {
      this.server?.to(`conv:${e.conversationId}`).emit('reaction:updated', e);
    });
    this.bus.onReadReceipt((e) => {
      this.server?.to(`conv:${e.conversationId}`).emit('read:receipt', e);
    });
    this.bus.onConversationUpdated((e) => {
      for (const uid of e.participantUserIds) {
        this.server?.to(`user:${uid}`).emit('conversation:updated', e.payload);
      }
    });
  }

  /* --------------------------------- cykl połączenia --------------------------------- */

  async handleConnection(socket: Socket): Promise<void> {
    try {
      const token = this.extractToken(socket);
      if (!token) return this.reject(socket);
      const payload = await this.jwt.verifyAsync<JwtUser>(token);
      const user = payload?.sub ? await this.users.findById(payload.sub) : null;
      if (!user || !user.isActive || !user.individualId) return this.reject(socket);

      const jwtUser: JwtUser = {
        sub: user.id,
        email: user.email,
        role: user.role,
        individualId: user.individualId,
        locale: user.locale,
      };
      (socket.data as SocketData) = { jwtUser, userId: user.id };
      socket.join(`user:${user.id}`);

      const becameOnline = this.presence.connect(user.id, socket.id);
      const pending = this.offlineTimers.get(user.id);
      if (pending) {
        clearTimeout(pending);
        this.offlineTimers.delete(user.id);
      }
      if (becameOnline) await this.broadcastPresence(user.id, 'online');
    } catch {
      this.reject(socket);
    }
  }

  async handleDisconnect(socket: Socket): Promise<void> {
    const data = socket.data as SocketData | undefined;
    if (!data?.userId) return;
    const wentOffline = this.presence.disconnect(data.userId, socket.id);
    if (!wentOffline) return;
    // Debounce: nie migotać przy reloadzie/krótkim zerwaniu.
    const timer = setTimeout(() => {
      this.offlineTimers.delete(data.userId);
      if (this.presence.isOnline(data.userId)) return;
      void this.persistLastSeen(data.userId);
      void this.broadcastPresence(data.userId, 'offline');
    }, OFFLINE_DEBOUNCE_MS);
    this.offlineTimers.set(data.userId, timer);
  }

  /* --------------------------------- zdarzenia klienta --------------------------------- */

  @SubscribeMessage('conv:join')
  async onJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string },
  ): Promise<{ ok: boolean }> {
    const me = this.me(socket);
    if (data?.conversationId && (await this.chat.isParticipant(data.conversationId, me.sub))) {
      socket.join(`conv:${data.conversationId}`);
      return { ok: true };
    }
    return { ok: false };
  }

  @SubscribeMessage('conv:leave')
  onLeave(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string },
  ): { ok: boolean } {
    if (data?.conversationId) socket.leave(`conv:${data.conversationId}`);
    return { ok: true };
  }

  @SubscribeMessage('message:send')
  async onSend(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    data: {
      conversationId: string;
      tempId?: string;
      body?: string;
      replyToId?: string;
      attachmentIds?: string[];
    },
  ): Promise<Record<string, unknown>> {
    const me = this.me(socket);
    try {
      const message = await this.chat.sendMessage(me, data.conversationId, {
        body: data.body,
        replyToId: data.replyToId ?? null,
        attachmentIds: data.attachmentIds,
      });
      return { ok: true, tempId: data.tempId, message };
    } catch (err) {
      return { ok: false, tempId: data.tempId, error: (err as Error).message };
    }
  }

  @SubscribeMessage('message:edit')
  async onEdit(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { messageId: string; body: string },
  ): Promise<Record<string, unknown>> {
    const me = this.me(socket);
    try {
      const message = await this.chat.editMessage(me, data.messageId, data.body);
      return { ok: true, message };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  @SubscribeMessage('message:delete')
  async onDelete(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { messageId: string },
  ): Promise<{ ok: boolean; error?: string }> {
    const me = this.me(socket);
    try {
      await this.chat.deleteMessage(me, data.messageId);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  @SubscribeMessage('message:react')
  async onReact(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { messageId: string; emoji: string; op: 'add' | 'remove' },
  ): Promise<{ ok: boolean; error?: string }> {
    const me = this.me(socket);
    try {
      await this.chat.react(me, data.messageId, data.emoji, data.op !== 'remove');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  @SubscribeMessage('read:mark')
  async onReadMark(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string; messageId: string },
  ): Promise<{ ok: boolean; error?: string }> {
    const me = this.me(socket);
    try {
      await this.chat.markRead(me, data.conversationId, data.messageId);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  @SubscribeMessage('typing:start')
  onTypingStart(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string },
  ): void {
    this.relayTyping(socket, data?.conversationId, true);
  }

  @SubscribeMessage('typing:stop')
  onTypingStop(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string },
  ): void {
    this.relayTyping(socket, data?.conversationId, false);
  }

  /* --------------------------------- helpery --------------------------------- */

  private relayTyping(socket: Socket, conversationId: string | undefined, isTyping: boolean): void {
    if (!conversationId) return;
    const me = this.me(socket);
    // Efemeryczne — bez zapisu; do wszystkich w pokoju oprócz nadawcy.
    socket.to(`conv:${conversationId}`).emit('typing:update', {
      conversationId,
      userId: me.sub,
      isTyping,
    });
  }

  /** Push tylko do odbiorców, których żaden socket nie ogląda aktualnie tej rozmowy. */
  private async pushOffline(e: MessageNewEvent): Promise<void> {
    if (!this.server || !e.recipientUserIds.length) return;
    try {
      const sockets = await this.server.in(`conv:${e.conversationId}`).fetchSockets();
      const viewing = new Set(sockets.map((s) => (s.data as SocketData)?.userId).filter(Boolean));
      const targets = e.recipientUserIds.filter((uid) => !viewing.has(uid));
      if (targets.length) await this.push.notifyNewMessage(targets, e.message);
    } catch (err) {
      this.logger.warn(`Push offline nieudany: ${(err as Error).message}`);
    }
  }

  private async broadcastPresence(userId: string, status: 'online' | 'offline'): Promise<void> {
    if (!this.server) return;
    const lastSeenAt = status === 'offline' ? new Date().toISOString() : null;
    const payload: PresencePayload = { userId, status, lastSeenAt };
    const contacts = await this.chat.coParticipantUserIds(userId);
    for (const cid of contacts) this.server.to(`user:${cid}`).emit('presence:update', payload);
  }

  private async persistLastSeen(userId: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) return;
    user.lastSeenAt = new Date();
    await this.users.save(user);
  }

  private me(socket: Socket): JwtUser {
    return (socket.data as SocketData).jwtUser;
  }

  private extractToken(socket: Socket): string | null {
    const fromAuth = (socket.handshake.auth as { token?: string })?.token;
    if (fromAuth) return fromAuth;
    const header = socket.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);
    const q = socket.handshake.query?.token;
    return typeof q === 'string' ? q : null;
  }

  private reject(socket: Socket): void {
    socket.disconnect(true);
  }
}
