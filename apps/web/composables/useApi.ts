import type {
  Bundle,
  BundlePayload,
  ChatAttachmentDto,
  ChatContact,
  ChatMessageDto,
  ChatTranslationDto,
  ConversationDto,
  EventDto,
  GedcomDateValue,
  IndividualDto,
  MediaDto,
  MediaTagDto,
  PersonCard,
  PersonName,
  Sex,
} from '@rodno/shared';

export interface TreeSummary {
  id: string;
  name: string;
  title: string | null;
  individualCount: number;
  focalId: string | null;
}

/** Konto czekające na przypisanie do osoby (panel admina). */
export interface PendingUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  createdAt: string;
}

/** Częściowa edycja osoby (pola opcjonalne). */
export interface IndividualPatch {
  names?: PersonName[];
  sex?: Sex;
  bio?: string | null;
  linkedinUrl?: string | null;
  xUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  emails?: string[];
}

/** Body zdarzenia osi czasu. */
export interface EventPatch {
  type?: string;
  date?: GedcomDateValue | null;
  dateRaw?: string | null;
  placeName?: string | null;
  value?: string | null;
  participants?: Array<{
    individualId?: string | null;
    name?: string | null;
    role?: string;
    sortOrder?: number;
  }>;
}

export function useApi() {
  const base = useApiBase();
  // Token z cookie (czytelne, działa też w SSR) → nagłówek Bearer na każdym żądaniu.
  const token = useCookie<string | null>('rodno_token');
  const authHeaders = (): Record<string, string> =>
    token.value ? { Authorization: `Bearer ${token.value}` } : {};
  const get = <T>(path: string) => $fetch<T>(`${base}${path}`, { headers: authHeaders() });
  const send = <T>(path: string, method: string, body?: unknown) =>
    $fetch<T>(`${base}${path}`, {
      method: method as any,
      body: body as any,
      headers: authHeaders(),
    });

  return {
    /** Publiczny agregat dla landingu (bez auth): top nazwiska w drzewie. */
    topSurnames: (tree: string, limit = 20) =>
      get<Array<{ surname: string; count: number }>>(
        `/public/surnames?tree=${encodeURIComponent(tree)}&limit=${limit}`,
      ),

    trees: () => get<TreeSummary[]>('/trees'),
    tree: (name: string) => get<TreeSummary>(`/trees/${encodeURIComponent(name)}`),
    payload: (id: string, up = 4, down = 2) =>
      get<BundlePayload>(`/individuals/${id}/payload?up=${up}&down=${down}`),
    bundle: (id: string) => get<Bundle>(`/individuals/${id}/bundle`),
    individual: (id: string) => get<IndividualDto>(`/individuals/${id}`),
    search: (treeId: string, q: string) =>
      get<PersonCard[]>(
        `/individuals?treeId=${treeId}&search=${encodeURIComponent(q)}&limit=20`,
      ),

    /* ----------------------------------- admin ----------------------------------- */

    adminPendingUsers: () => get<PendingUser[]>('/admin/users/pending'),

    adminAssignIndividual: (userId: string, individualId: string) =>
      send<PendingUser>(`/admin/users/${userId}/individual`, 'PATCH', { individualId }),

    /* ----------------------------------- zapis ----------------------------------- */

    updateIndividual: (id: string, patch: IndividualPatch) =>
      send<IndividualDto>(`/individuals/${id}`, 'PATCH', patch),

    uploadAvatar: (id: string, file: Blob, filename = 'avatar.jpg') => {
      const fd = new FormData();
      fd.append('file', file, filename);
      return send<IndividualDto>(`/individuals/${id}/avatar`, 'POST', fd);
    },

    gallery: (id: string) => get<MediaDto[]>(`/individuals/${id}/gallery`),

    uploadMedia: (id: string, files: File[]) => {
      const fd = new FormData();
      for (const f of files) fd.append('files', f, f.name);
      return send<MediaDto[]>(`/individuals/${id}/media`, 'POST', fd);
    },

    reorderMedia: (id: string, ids: string[]) =>
      send<void>(`/individuals/${id}/media/order`, 'PATCH', { ids }),

    patchMedia: (
      mediaId: string,
      patch: { caption?: string | null; takenDate?: GedcomDateValue | string | null },
    ) => send<MediaDto>(`/media/${mediaId}`, 'PATCH', patch),

    putMediaTags: (mediaId: string, tags: Array<Partial<MediaTagDto>>) =>
      send<MediaDto>(`/media/${mediaId}/tags`, 'PUT', { tags }),

    deleteMedia: (mediaId: string) => send<void>(`/media/${mediaId}`, 'DELETE'),

    addMarriage: (id: string, body: { spouseId: string; type?: string }) =>
      send<IndividualDto>(`/individuals/${id}/marriages`, 'POST', body),

    patchMarriage: (
      id: string,
      pid: string,
      body: {
        spouseId?: string | null;
        type?: string;
        date?: GedcomDateValue | null;
        dateRaw?: string | null;
        placeName?: string | null;
      },
    ) => send<IndividualDto>(`/individuals/${id}/marriages/${pid}`, 'PATCH', body),

    deleteMarriage: (id: string, pid: string) =>
      send<IndividualDto>(`/individuals/${id}/marriages/${pid}`, 'DELETE'),

    uploadMarriagePhoto: (id: string, pid: string, file: Blob, filename = 'slub.jpg') => {
      const fd = new FormData();
      fd.append('file', file, filename);
      return send<IndividualDto>(`/individuals/${id}/marriages/${pid}/photo`, 'POST', fd);
    },

    addEvent: (id: string, ev: EventPatch) =>
      send<EventDto>(`/individuals/${id}/events`, 'POST', ev),

    patchEvent: (eventId: string, ev: EventPatch) =>
      send<EventDto>(`/events/${eventId}`, 'PATCH', ev),

    deleteEvent: (eventId: string) => send<void>(`/events/${eventId}`, 'DELETE'),

    /* ----------------------------------- czat ----------------------------------- */

    chatContacts: () => get<ChatContact[]>('/chat/contacts'),
    conversations: () => get<ConversationDto[]>('/chat/conversations'),
    conversation: (id: string) => get<ConversationDto>(`/chat/conversations/${id}`),
    createDirect: (userId: string) =>
      send<ConversationDto>('/chat/conversations/direct', 'POST', { userId }),
    createGroup: (title: string, userIds: string[]) =>
      send<ConversationDto>('/chat/conversations/group', 'POST', { title, userIds }),
    renameGroup: (id: string, title: string) =>
      send<ConversationDto>(`/chat/conversations/${id}`, 'PATCH', { title }),
    addParticipants: (id: string, userIds: string[]) =>
      send<ConversationDto>(`/chat/conversations/${id}/participants`, 'POST', { userIds }),
    removeParticipant: (id: string, userId: string) =>
      send<void>(`/chat/conversations/${id}/participants/${userId}`, 'DELETE'),
    chatMessages: (id: string, before?: number) =>
      get<ChatMessageDto[]>(
        `/chat/conversations/${id}/messages?limit=30${before ? `&before=${before}` : ''}`,
      ),
    sendMessage: (
      id: string,
      body: { body?: string; replyToId?: string; attachmentIds?: string[] },
    ) => send<ChatMessageDto>(`/chat/conversations/${id}/messages`, 'POST', body),
    uploadChatImages: (id: string, files: File[]) => {
      const fd = new FormData();
      for (const f of files) fd.append('files', f, f.name);
      return send<ChatAttachmentDto[]>(`/chat/conversations/${id}/attachments`, 'POST', fd);
    },
    markRead: (id: string, messageId: string) =>
      send<void>(`/chat/conversations/${id}/read`, 'POST', { messageId }),
    editMessage: (id: string, body: string) =>
      send<ChatMessageDto>(`/chat/messages/${id}`, 'PATCH', { body }),
    deleteMessage: (id: string) => send<void>(`/chat/messages/${id}`, 'DELETE'),
    addReaction: (id: string, emoji: string) =>
      send<void>(`/chat/messages/${id}/reactions`, 'POST', { emoji }),
    removeReaction: (id: string, emoji: string) =>
      send<void>(`/chat/messages/${id}/reactions?emoji=${encodeURIComponent(emoji)}`, 'DELETE'),
    translateMessage: (id: string, locale: string) =>
      get<ChatTranslationDto>(`/chat/messages/${id}/translation?locale=${locale}`),
    pushSubscribe: (sub: { endpoint: string; keys: { p256dh: string; auth: string }; userAgent?: string }) =>
      send<void>('/chat/push/subscribe', 'POST', sub),
    pushUnsubscribe: (endpoint: string) =>
      send<void>('/chat/push/subscribe', 'DELETE', { endpoint }),
  };
}
