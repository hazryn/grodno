import type {
  ChatContact,
  ChatMessageDto,
  ConversationDto,
  ConversationUpdatedPayload,
  PresencePayload,
  ReactionUpdatePayload,
  ReadReceiptPayload,
  TypingPayload,
} from '@rodno/shared';

/** Wiadomość w kliencie: DTO + stan optimistic/tłumaczenia (pola z prefiksem `_`). */
export interface ChatMessage extends ChatMessageDto {
  _status?: 'sending' | 'sent' | 'failed';
  _tempId?: string;
  _translation?: { text: string; showing: boolean; loading: boolean };
}

export interface OpenWindow {
  conversationId: string;
  minimized: boolean;
}

const MAX_OPEN_WINDOWS = 3;

/**
 * Sklep czatu (useState, wzorzec jak useAuth). Jedno źródło prawdy dla rozmów, wiadomości,
 * obecności, „pisze…" i otwartych okienek. Emisje realtime idą przez useChatSocket (leniwie,
 * w akcjach — bez cyklu z reducerami).
 */
export function useChat() {
  const api = useApi();
  const { user } = useAuth();

  const conversations = useState<ConversationDto[]>('chat_convos', () => []);
  const messages = useState<Record<string, ChatMessage[]>>('chat_msgs', () => ({}));
  const loaded = useState<Record<string, boolean>>('chat_loaded', () => ({}));
  const contacts = useState<ChatContact[]>('chat_contacts', () => []);
  const presence = useState<Record<string, { online: boolean; lastSeenAt: string | null }>>(
    'chat_presence',
    () => ({}),
  );
  const typing = useState<Record<string, string[]>>('chat_typing', () => ({}));
  const openWindows = useState<OpenWindow[]>('chat_windows', () => []);
  const activeWindow = useState<string | null>('chat_active', () => null);
  const sheetOpen = useState<boolean>('chat_sheet', () => false);

  const meId = computed(() => user.value?.id ?? null);
  const totalUnread = computed(() =>
    conversations.value.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
  );
  const sortedConversations = computed(() =>
    [...conversations.value].sort((a, b) =>
      (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''),
    ),
  );

  /* --------------------------------- ładowanie --------------------------------- */

  async function loadConversations(): Promise<void> {
    conversations.value = await api.conversations();
    for (const c of conversations.value) syncPresenceFromConversation(c);
  }

  async function loadContacts(): Promise<void> {
    contacts.value = await api.chatContacts();
  }

  async function loadMessages(convId: string): Promise<void> {
    if (loaded.value[convId]) return;
    const rows = await api.chatMessages(convId);
    messages.value[convId] = rows.map((m) => ({ ...m }));
    loaded.value[convId] = true;
  }

  async function loadMore(convId: string): Promise<number> {
    const list = messages.value[convId] ?? [];
    const oldest = list.find((m) => m._status !== 'sending');
    if (!oldest) return 0;
    const rows = await api.chatMessages(convId, oldest.seq);
    if (!rows.length) return 0;
    messages.value[convId] = [...rows.map((m) => ({ ...m })), ...list];
    return rows.length;
  }

  async function refreshConversation(convId: string): Promise<void> {
    try {
      const dto = await api.conversation(convId);
      upsertConversation(dto);
      syncPresenceFromConversation(dto);
    } catch {
      // brak dostępu / usunięto — wypadnij z listy
      conversations.value = conversations.value.filter((c) => c.id !== convId);
    }
  }

  /* --------------------------------- okna / sheet --------------------------------- */

  function openWindow(convId: string): void {
    const existing = openWindows.value.find((w) => w.conversationId === convId);
    if (existing) existing.minimized = false;
    else {
      openWindows.value = [{ conversationId: convId, minimized: false }, ...openWindows.value];
      // Zwiń najstarsze ponad limit (jak „chat heads" w FB).
      const open = openWindows.value.filter((w) => !w.minimized);
      if (open.length > MAX_OPEN_WINDOWS) {
        const overflow = open[open.length - 1];
        overflow.minimized = true;
      }
    }
    activeWindow.value = convId;
  }

  function closeWindow(convId: string): void {
    openWindows.value = openWindows.value.filter((w) => w.conversationId !== convId);
    useChatSocket().leave(convId);
    if (activeWindow.value === convId) activeWindow.value = null;
  }

  function minimizeWindow(convId: string): void {
    const w = openWindows.value.find((x) => x.conversationId === convId);
    if (w) w.minimized = true;
    if (activeWindow.value === convId) activeWindow.value = null;
  }

  async function openConversation(convId: string): Promise<void> {
    if (!conversations.value.some((c) => c.id === convId)) await refreshConversation(convId);
    openWindow(convId);
    await loadMessages(convId);
    useChatSocket().join(convId);
    markLatestRead(convId);
  }

  /** Otwiera (lub tworzy) rozmowę 1:1 z osobą po jej userId. */
  async function openDirect(userId: string): Promise<void> {
    const dto = await api.createDirect(userId);
    upsertConversation(dto);
    await openConversation(dto.id);
  }

  /** Tworzy grupę i ją otwiera. */
  async function createGroup(title: string, userIds: string[]): Promise<void> {
    const dto = await api.createGroup(title, userIds);
    upsertConversation(dto);
    await openConversation(dto.id);
  }

  /** Otwiera rozmowę 1:1 na podstawie osoby w drzewie (individualId → userId z kontaktów). */
  async function openDirectByIndividual(individualId: string): Promise<boolean> {
    if (!contacts.value.length) await loadContacts();
    const contact = contacts.value.find((c) => c.individualId === individualId);
    if (!contact) return false;
    await openDirect(contact.userId);
    return true;
  }

  function contactByIndividualId(individualId: string): ChatContact | null {
    return contacts.value.find((c) => c.individualId === individualId) ?? null;
  }

  function toggleSheet(force?: boolean): void {
    sheetOpen.value = force ?? !sheetOpen.value;
  }

  /* --------------------------------- wysyłka / akcje --------------------------------- */

  async function sendText(convId: string, body: string): Promise<void> {
    const text = body.trim();
    if (!text) return;
    const tempId = cryptoRandom();
    const temp = optimistic(convId, { body: text, type: 'text', _tempId: tempId });
    appendMessage(convId, temp);
    const socket = useChatSocket();
    try {
      const res = await socket.send({ conversationId: convId, tempId, body: text });
      reconcile(convId, tempId, res);
    } catch {
      markFailed(convId, tempId);
    }
  }

  async function sendImages(convId: string, files: File[]): Promise<void> {
    if (!files.length) return;
    const uploaded = await api.uploadChatImages(convId, files);
    const tempId = cryptoRandom();
    const temp = optimistic(convId, {
      type: 'image',
      _tempId: tempId,
      attachments: uploaded,
    });
    appendMessage(convId, temp);
    const socket = useChatSocket();
    try {
      const res = await socket.send({
        conversationId: convId,
        tempId,
        attachmentIds: uploaded.map((a) => a.id),
      });
      reconcile(convId, tempId, res);
    } catch {
      markFailed(convId, tempId);
    }
  }

  async function retry(convId: string, tempId: string): Promise<void> {
    const list = messages.value[convId] ?? [];
    const msg = list.find((m) => m._tempId === tempId);
    if (!msg) return;
    msg._status = 'sending';
    const socket = useChatSocket();
    try {
      const res = await socket.send({
        conversationId: convId,
        tempId,
        body: msg.body ?? undefined,
        attachmentIds: msg.attachments.map((a) => a.id),
      });
      reconcile(convId, tempId, res);
    } catch {
      markFailed(convId, tempId);
    }
  }

  async function editMessage(convId: string, messageId: string, body: string): Promise<void> {
    await useChatSocket().edit(messageId, body);
  }

  async function deleteMessage(convId: string, messageId: string): Promise<void> {
    await useChatSocket().remove(messageId);
  }

  async function toggleReaction(messageId: string, emoji: string, mine: boolean): Promise<void> {
    await useChatSocket().react(messageId, emoji, mine ? 'remove' : 'add');
  }

  function setTyping(convId: string, isTyping: boolean): void {
    useChatSocket().typing(convId, isTyping);
  }

  function markLatestRead(convId: string): void {
    const list = messages.value[convId] ?? [];
    const last = [...list].reverse().find((m) => m._status !== 'sending');
    if (last) {
      useChatSocket().read(convId, last.id);
      const conv = conversations.value.find((c) => c.id === convId);
      if (conv) conv.unreadCount = 0;
    }
  }

  async function translate(convId: string, message: ChatMessage): Promise<void> {
    const locale = user.value?.locale ?? 'pl';
    if (message._translation?.text) {
      message._translation.showing = !message._translation.showing;
      return;
    }
    message._translation = { text: '', showing: false, loading: true };
    try {
      const res = await api.translateMessage(message.id, locale);
      message._translation = { text: res.text, showing: true, loading: false };
    } catch {
      message._translation = { text: message.body ?? '', showing: false, loading: false };
    }
  }

  /* --------------------------------- reducery realtime --------------------------------- */

  function applyNew(message: ChatMessageDto): void {
    upsertMessage(message.conversationId, { ...message });
    const focused = activeWindow.value === message.conversationId;
    const open = openWindows.value.find(
      (w) => w.conversationId === message.conversationId && !w.minimized,
    );
    if (focused && open && message.senderId !== meId.value) {
      markLatestRead(message.conversationId);
    }
  }

  function applyEdited(message: ChatMessageDto): void {
    upsertMessage(message.conversationId, { ...message });
  }

  function applyDeleted(p: { conversationId: string; messageId: string }): void {
    const list = messages.value[p.conversationId];
    if (!list) return;
    const msg = list.find((m) => m.id === p.messageId);
    if (msg) {
      msg.deletedAt = new Date().toISOString();
      msg.body = null;
      msg.attachments = [];
      msg.reactions = [];
    }
  }

  function applyReaction(p: ReactionUpdatePayload): void {
    const list = messages.value[p.conversationId];
    const msg = list?.find((m) => m.id === p.messageId);
    if (!msg) return;
    const existing = msg.reactions.find((r) => r.emoji === p.emoji);
    if (p.op === 'add') {
      if (existing) {
        if (!existing.userIds.includes(p.userId)) {
          existing.userIds.push(p.userId);
          existing.count = existing.userIds.length;
        }
      } else {
        msg.reactions.push({ emoji: p.emoji, count: 1, userIds: [p.userId], mine: p.userId === meId.value });
      }
    } else if (existing) {
      existing.userIds = existing.userIds.filter((id) => id !== p.userId);
      existing.count = existing.userIds.length;
      if (!existing.count) msg.reactions = msg.reactions.filter((r) => r.emoji !== p.emoji);
    }
    const r = msg.reactions.find((x) => x.emoji === p.emoji);
    if (r) r.mine = r.userIds.includes(meId.value ?? '');
  }

  function applyReadReceipt(p: ReadReceiptPayload): void {
    const conv = conversations.value.find((c) => c.id === p.conversationId);
    const part = conv?.participants.find((x) => x.userId === p.userId);
    if (part) part.lastReadSeq = p.lastReadSeq;
  }

  function applyTyping(p: TypingPayload): void {
    const list = new Set(typing.value[p.conversationId] ?? []);
    if (p.isTyping) list.add(p.userId);
    else list.delete(p.userId);
    typing.value[p.conversationId] = [...list];
    if (p.isTyping) scheduleTypingClear(p.conversationId, p.userId);
  }

  function applyPresence(p: PresencePayload): void {
    presence.value[p.userId] = { online: p.status === 'online', lastSeenAt: p.lastSeenAt };
  }

  async function applyConversationUpdated(p: ConversationUpdatedPayload): Promise<void> {
    await refreshConversation(p.conversationId);
  }

  async function resync(): Promise<void> {
    await loadConversations();
    for (const convId of Object.keys(loaded.value)) {
      if (loaded.value[convId]) {
        const rows = await api.chatMessages(convId);
        mergeMessages(convId, rows);
      }
    }
  }

  function reset(): void {
    conversations.value = [];
    messages.value = {};
    loaded.value = {};
    contacts.value = [];
    presence.value = {};
    typing.value = {};
    openWindows.value = [];
    activeWindow.value = null;
    sheetOpen.value = false;
  }

  /* --------------------------------- helpery --------------------------------- */

  function socketHandlers() {
    return {
      onNew: applyNew,
      onEdited: applyEdited,
      onDeleted: applyDeleted,
      onReaction: applyReaction,
      onReadReceipt: applyReadReceipt,
      onTyping: applyTyping,
      onPresence: applyPresence,
      onConversationUpdated: applyConversationUpdated,
      onReconnect: resync,
    };
  }

  function optimistic(convId: string, partial: Partial<ChatMessage>): ChatMessage {
    const list = messages.value[convId] ?? [];
    const maxSeq = list.reduce((m, x) => Math.max(m, x.seq), 0);
    return {
      id: partial._tempId ?? cryptoRandom(),
      conversationId: convId,
      seq: maxSeq + 1,
      senderId: meId.value,
      type: partial.type ?? 'text',
      body: partial.body ?? null,
      replyToId: null,
      systemKind: null,
      systemMeta: null,
      attachments: partial.attachments ?? [],
      reactions: [],
      editedAt: null,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      _status: 'sending',
      _tempId: partial._tempId,
    };
  }

  function appendMessage(convId: string, msg: ChatMessage): void {
    const list = messages.value[convId] ?? [];
    messages.value[convId] = [...list, msg];
  }

  function reconcile(convId: string, tempId: string, res: { ok: boolean; message?: ChatMessageDto }): void {
    const list = messages.value[convId] ?? [];
    const idx = list.findIndex((m) => m._tempId === tempId);
    if (!res.ok || !res.message) {
      if (idx >= 0) list[idx]._status = 'failed';
      return;
    }
    const real = res.message;
    const already = list.some((m) => m.id === real.id && m._tempId !== tempId);
    if (idx >= 0) {
      if (already) list.splice(idx, 1);
      else list[idx] = { ...real, _status: 'sent' };
    }
    messages.value[convId] = [...list].sort((a, b) => a.seq - b.seq);
  }

  function markFailed(convId: string, tempId: string): void {
    const msg = (messages.value[convId] ?? []).find((m) => m._tempId === tempId);
    if (msg) msg._status = 'failed';
  }

  function upsertMessage(convId: string, message: ChatMessage): void {
    const list = messages.value[convId] ?? [];
    const idx = list.findIndex((m) => m.id === message.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...message, _translation: list[idx]._translation };
      messages.value[convId] = [...list];
    } else if (loaded.value[convId]) {
      messages.value[convId] = [...list, message].sort((a, b) => a.seq - b.seq);
    }
  }

  function mergeMessages(convId: string, rows: ChatMessageDto[]): void {
    const list = messages.value[convId] ?? [];
    const byId = new Map(list.map((m) => [m.id, m]));
    for (const r of rows) {
      const existing = byId.get(r.id);
      if (existing) Object.assign(existing, r);
      else list.push({ ...r });
    }
    messages.value[convId] = [...list].sort((a, b) => a.seq - b.seq);
  }

  function upsertConversation(dto: ConversationDto): void {
    const idx = conversations.value.findIndex((c) => c.id === dto.id);
    if (idx >= 0) conversations.value[idx] = dto;
    else conversations.value = [dto, ...conversations.value];
  }

  function syncPresenceFromConversation(c: ConversationDto): void {
    for (const p of c.participants) {
      if (!presence.value[p.userId]) {
        presence.value[p.userId] = { online: p.online, lastSeenAt: p.lastSeenAt };
      }
    }
  }

  const typingTimers: Record<string, ReturnType<typeof setTimeout>> = {};
  function scheduleTypingClear(convId: string, userId: string): void {
    const key = `${convId}:${userId}`;
    if (typingTimers[key]) clearTimeout(typingTimers[key]);
    typingTimers[key] = setTimeout(() => applyTyping({ conversationId: convId, userId, isTyping: false }), 5000);
  }

  return {
    conversations,
    sortedConversations,
    messages,
    contacts,
    presence,
    typing,
    openWindows,
    activeWindow,
    sheetOpen,
    meId,
    totalUnread,
    loadConversations,
    loadContacts,
    loadMessages,
    loadMore,
    refreshConversation,
    openWindow,
    closeWindow,
    minimizeWindow,
    openConversation,
    openDirect,
    openDirectByIndividual,
    contactByIndividualId,
    createGroup,
    toggleSheet,
    sendText,
    sendImages,
    retry,
    editMessage,
    deleteMessage,
    toggleReaction,
    setTyping,
    markLatestRead,
    translate,
    socketHandlers,
    resync,
    reset,
    peer: (conv: ConversationDto) =>
      conv.participants.find((p) => p.userId !== meId.value) ?? conv.participants[0] ?? null,
    isOnline: (userId: string | null | undefined) =>
      userId ? presence.value[userId]?.online ?? false : false,
    lastSeenOf: (userId: string | null | undefined) =>
      userId ? presence.value[userId]?.lastSeenAt ?? null : null,
    conversationById: (id: string) => conversations.value.find((c) => c.id === id) ?? null,
  };
}

function cryptoRandom(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `tmp-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}
