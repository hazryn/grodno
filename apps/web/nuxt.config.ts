// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  modules: ['@nuxtjs/tailwindcss', '@nuxtjs/i18n'],
  // Style biblioteki croppera. Lightbox wstrzykuje własne style; sort galerii = natywny DnD.
  css: ['vue-advanced-cropper/dist/style.css'],
  // Porty 52+ — bez konfliktów z innymi projektami lokalnymi.
  devServer: { port: 5200 },
  // i18n: język w URL (prefiks dla każdego: /pl, /en, /de), domyślnie polski.
  i18n: {
    strategy: 'prefix',
    defaultLocale: 'pl',
    baseUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:5200',
    lazy: true,
    // Pliki w apps/web/i18n/locales/ (restructureDir = 'i18n' w v10).
    locales: [
      { code: 'pl', language: 'pl-PL', name: 'Polski', file: 'pl.json' },
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
      { code: 'de', language: 'de-DE', name: 'Deutsch', file: 'de.json' },
    ],
    // Pierwsza wizyta: wykryj język przeglądarki, fallback PL, zapamiętaj w cookie.
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root',
      fallbackLocale: 'pl',
    },
    // Wyłączamy dyrektywę v-t (używamy $t/t) — bez ostrzeżeń o deprecacji.
    bundle: { optimizeTranslationDirective: false },
  },
  runtimeConfig: {
    // Prywatne (tylko serwer/SSR): adres API w sieci kontenerów. Puste = użyj public.apiBase.
    apiBaseServer: process.env.NUXT_API_BASE_SERVER || '',
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:5201/api',
      // Slug drzewa ładowanego po zalogowaniu (musi istnieć w bazie).
      treeName: process.env.NUXT_PUBLIC_TREE_NAME || 'szejna',
      // Branding neutralny językowo (interpolowany do tłumaczeń). Treści landingu → katalogi i18n.
      appTitle: process.env.NUXT_PUBLIC_APP_TITLE || 'Rodno',
      familyName: process.env.NUXT_PUBLIC_FAMILY_NAME || '',
      contactEmail: process.env.NUXT_PUBLIC_CONTACT_EMAIL || '',
      // WebSocket czatu (Socket.IO). Puste = wyprowadź z apiBase (origin bez /api).
      wsBase: process.env.NUXT_PUBLIC_WS_BASE || '',
      // Klucz publiczny VAPID do web push (klucz prywatny zostaje po stronie API).
      vapidPublicKey: process.env.NUXT_PUBLIC_VAPID_PUBLIC_KEY || '',
    },
  },
  app: {
    head: {
      title: 'Rodno',
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    },
  },
});
