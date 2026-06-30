import type {
  Bundle,
  BundlePayload,
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
  const base = useRuntimeConfig().public.apiBase as string;
  const get = <T>(path: string) => $fetch<T>(`${base}${path}`);
  const send = <T>(path: string, method: string, body?: unknown) =>
    $fetch<T>(`${base}${path}`, { method: method as any, body: body as any });

  return {
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

    addEvent: (id: string, ev: EventPatch) =>
      send<EventDto>(`/individuals/${id}/events`, 'POST', ev),

    patchEvent: (eventId: string, ev: EventPatch) =>
      send<EventDto>(`/events/${eventId}`, 'PATCH', ev),

    deleteEvent: (eventId: string) => send<void>(`/events/${eventId}`, 'DELETE'),
  };
}
