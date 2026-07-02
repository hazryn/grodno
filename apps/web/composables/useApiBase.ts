/**
 * Baza URL API. W SSR (kod leci w kontenerze/serwerze) `localhost:5201` NIE wskazuje na API
 * — używamy wtedy adresu wewnętrznego (np. http://api:5201/api z NUXT_API_BASE_SERVER).
 * W przeglądarce używamy publicznego adresu (localhost:5201). Dzięki temu SSR /auth/me
 * działa i nie wylogowuje przy każdym pełnym załadowaniu strony.
 */
export function useApiBase(): string {
  const config = useRuntimeConfig();
  const serverBase = config.apiBaseServer as string | undefined;
  if (import.meta.server && serverBase) return serverBase;
  return config.public.apiBase as string;
}
