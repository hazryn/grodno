// Import jawny (nie auto-import) — auto-import tego composable bywał gubiony przy HMR.
import { useApiBase } from './useApiBase';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  individualId: string | null;
  locale: string;
}

export type ConfirmResult =
  | { status: 'approved'; accessToken: string; user: AuthUser }
  | { status: 'pending_admin' };

const TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 dni — spójnie z JWT_EXPIRES_IN.

/**
 * Stan logowania. Token w cookie czytelnym (dostępny w SSR przez useCookie),
 * dane usera w useState (hydratowane przez plugins/auth.ts). useApi dokłada Bearer.
 */
export function useAuth() {
  const base = useApiBase();
  const token = useCookie<string | null>('rodno_token', {
    maxAge: TOKEN_MAX_AGE,
    sameSite: 'lax',
    path: '/',
  });
  const user = useState<AuthUser | null>('auth_user', () => null);

  const isLoggedIn = computed(() => !!user.value);
  const isAdmin = computed(() => user.value?.role === 'admin');

  function setSession(accessToken: string, u: AuthUser): void {
    token.value = accessToken;
    user.value = u;
  }

  function logout(): void {
    token.value = null;
    user.value = null;
  }

  /** Pobierz aktualnego usera po tokenie z cookie (łapie dezaktywację/zły token). */
  async function fetchMe(): Promise<AuthUser | null> {
    if (!token.value) {
      user.value = null;
      return null;
    }
    try {
      user.value = await $fetch<AuthUser>(`${base}/auth/me`, {
        headers: { Authorization: `Bearer ${token.value}` },
      });
    } catch (e: unknown) {
      // Wyloguj TYLKO gdy token odrzucony (401), nie przy chwilowej niedostępności API
      // (np. restart backendu / SSR bez dostępu do sieci) — inaczej wywala sesję bez powodu.
      const status = (e as { statusCode?: number; response?: { status?: number } })?.statusCode
        ?? (e as { response?: { status?: number } })?.response?.status;
      if (status === 401) logout();
    }
    return user.value;
  }

  async function login(email: string, password: string): Promise<AuthUser> {
    const res = await $fetch<{ accessToken: string; user: AuthUser }>(`${base}/auth/login`, {
      method: 'POST',
      body: { email, password },
    });
    setSession(res.accessToken, res.user);
    return res.user;
  }

  /** Zapis preferowanego języka na koncie (PATCH /auth/me). */
  async function updateLocale(locale: string): Promise<void> {
    if (!token.value) return;
    user.value = await $fetch<AuthUser>(`${base}/auth/me`, {
      method: 'PATCH',
      body: { locale },
      headers: { Authorization: `Bearer ${token.value}` },
    });
  }

  /* --------------------------------- funnel dostępu --------------------------------- */

  const requestAccess = (firstName: string, lastName: string, email: string, locale: string) =>
    $fetch<{ ok: true }>(`${base}/access/request`, {
      method: 'POST',
      body: { firstName, lastName, email, locale },
    });

  const confirm = (confirmToken: string, password: string) =>
    $fetch<ConfirmResult>(`${base}/access/confirm`, {
      method: 'POST',
      body: { token: confirmToken, password },
    });

  const forgot = (email: string) =>
    $fetch<{ ok: true }>(`${base}/access/forgot`, { method: 'POST', body: { email } });

  const reset = (resetToken: string, password: string) =>
    $fetch<ConfirmResult>(`${base}/access/reset`, {
      method: 'POST',
      body: { token: resetToken, password },
    });

  return {
    token,
    user,
    isLoggedIn,
    isAdmin,
    setSession,
    logout,
    fetchMe,
    login,
    updateLocale,
    requestAccess,
    confirm,
    forgot,
    reset,
  };
}
