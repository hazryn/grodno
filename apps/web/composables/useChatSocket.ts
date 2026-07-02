import { io, type Socket } from 'socket.io-client';
import type {
  ChatMessageDto,
  ConversationUpdatedPayload,
  PresencePayload,
  ReactionUpdatePayload,
  ReadReceiptPayload,
  TypingPayload,
} from '@rodno/shared';

interface SocketHandlers {
  onNew: (m: ChatMessageDto) => void;
  onEdited: (m: ChatMessageDto) => void;
  onDeleted: (p: { conversationId: string; messageId: string }) => void;
  onReaction: (p: ReactionUpdatePayload) => void;
  onReadReceipt: (p: ReadReceiptPayload) => void;
  onTyping: (p: TypingPayload) => void;
  onPresence: (p: PresencePayload) => void;
  onConversationUpdated: (p: ConversationUpdatedPayload) => void | Promise<void>;
  onReconnect: () => void | Promise<void>;
}

interface SendAck {
  ok: boolean;
  tempId?: string;
  message?: ChatMessageDto;
  error?: string;
}

// Singleton na całą aplikację (jeden socket per zakładka).
let socket: Socket | null = null;
let connectedOnce = false;

/**
 * Cykl życia Socket.IO (namespace /chat). Łączymy tylko po zalogowaniu; ten sam token JWT
 * co REST (cookie). Po ponownym połączeniu odświeżamy stan (resync). Emisje zwracają ack.
 */
export function useChatSocket() {
  const config = useRuntimeConfig();
  const token = useCookie<string | null>('rodno_token');
  const status = useState<'connecting' | 'online' | 'offline'>('chat_conn', () => 'offline');

  function wsOrigin(): string {
    const explicit = config.public.wsBase as string;
    if (explicit) return explicit;
    const apiBase = config.public.apiBase as string; // np. http://localhost:5201/api
    return apiBase.replace(/\/api\/?$/, '');
  }

  function connect(handlers: SocketHandlers): void {
    if (!import.meta.client || !token.value) return;
    if (socket) return;
    status.value = 'connecting';
    socket = io(`${wsOrigin()}/chat`, {
      auth: { token: token.value },
      transports: ['websocket'],
      reconnection: true,
    });

    socket.on('connect', () => {
      status.value = 'online';
      if (connectedOnce) void handlers.onReconnect();
      connectedOnce = true;
    });
    socket.on('disconnect', () => {
      status.value = 'offline';
    });
    socket.on('message:new', handlers.onNew);
    socket.on('message:edited', handlers.onEdited);
    socket.on('message:deleted', handlers.onDeleted);
    socket.on('reaction:updated', handlers.onReaction);
    socket.on('read:receipt', handlers.onReadReceipt);
    socket.on('typing:update', handlers.onTyping);
    socket.on('presence:update', handlers.onPresence);
    socket.on('conversation:updated', (p) => void handlers.onConversationUpdated(p));
  }

  function disconnect(): void {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    connectedOnce = false;
    status.value = 'offline';
  }

  async function emitAck<T>(event: string, data: unknown): Promise<T> {
    if (!socket) throw new Error('Brak połączenia z czatem');
    return (await socket.timeout(10000).emitWithAck(event, data)) as T;
  }

  return {
    status,
    connect,
    disconnect,
    isConnected: () => !!socket?.connected,
    send: (data: {
      conversationId: string;
      tempId: string;
      body?: string;
      attachmentIds?: string[];
    }) => emitAck<SendAck>('message:send', data),
    edit: (messageId: string, body: string) =>
      emitAck<SendAck>('message:edit', { messageId, body }),
    remove: (messageId: string) => emitAck<{ ok: boolean }>('message:delete', { messageId }),
    react: (messageId: string, emoji: string, op: 'add' | 'remove') =>
      emitAck<{ ok: boolean }>('message:react', { messageId, emoji, op }),
    join: (conversationId: string) => socket?.emit('conv:join', { conversationId }),
    leave: (conversationId: string) => socket?.emit('conv:leave', { conversationId }),
    read: (conversationId: string, messageId: string) =>
      socket?.emit('read:mark', { conversationId, messageId }),
    typing: (conversationId: string, isTyping: boolean) =>
      socket?.emit(isTyping ? 'typing:start' : 'typing:stop', { conversationId }),
  };
}
