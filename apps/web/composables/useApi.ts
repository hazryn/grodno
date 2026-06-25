import type {
  Bundle,
  BundlePayload,
  IndividualDto,
  PersonCard,
} from '@rodno/shared';

export interface TreeSummary {
  id: string;
  name: string;
  title: string | null;
  individualCount: number;
  focalId: string | null;
}

export function useApi() {
  const base = useRuntimeConfig().public.apiBase as string;
  const get = <T>(path: string) => $fetch<T>(`${base}${path}`);

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
  };
}
