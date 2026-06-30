/** Strony publiczne (landing, login): zalogowanego od razu kieruj do drzewa. */
export default defineNuxtRouteMiddleware(() => {
  const { isLoggedIn } = useAuth();
  const localePath = useLocalePath();
  if (isLoggedIn.value) {
    return navigateTo(localePath('/tree'));
  }
});
