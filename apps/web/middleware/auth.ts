/** Chroni strony aplikacji. Niezalogowany → /login. Strefa /admin → tylko rola admin. */
export default defineNuxtRouteMiddleware((to) => {
  const { isLoggedIn, isAdmin } = useAuth();
  const localePath = useLocalePath();
  if (!isLoggedIn.value) {
    return navigateTo({ path: localePath('/login'), query: { redirect: to.fullPath } });
  }
  // Ścieżki są prefiksowane locale (/de/admin/...), więc sprawdzamy segment.
  if (to.path.split('/').includes('admin') && !isAdmin.value) {
    return navigateTo(localePath('/tree'));
  }
});
