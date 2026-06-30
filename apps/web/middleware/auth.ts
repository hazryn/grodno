/** Chroni strony aplikacji. Niezalogowany → /login. Strefa /admin → tylko rola admin. */
export default defineNuxtRouteMiddleware((to) => {
  const { isLoggedIn, isAdmin } = useAuth();
  if (!isLoggedIn.value) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } });
  }
  if (to.path.startsWith('/admin') && !isAdmin.value) {
    return navigateTo('/tree');
  }
});
