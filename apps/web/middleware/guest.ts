/** Strony publiczne (landing, login): zalogowanego od razu kieruj do drzewa. */
export default defineNuxtRouteMiddleware(() => {
  const { isLoggedIn } = useAuth();
  if (isLoggedIn.value) {
    return navigateTo('/tree');
  }
});
