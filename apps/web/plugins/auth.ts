/**
 * Hydratacja sesji przy starcie aplikacji (SSR + klient). Jeśli cookie z tokenem
 * jest obecne, pobieramy /auth/me, by SSR znał rolę i individualId (centrowanie na sobie).
 */
export default defineNuxtPlugin(async () => {
  const { token, user, fetchMe } = useAuth();
  if (token.value && !user.value) {
    await fetchMe();
  }
});
