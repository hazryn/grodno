// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  modules: ['@nuxtjs/tailwindcss'],
  // Style biblioteki croppera. Lightbox wstrzykuje własne style; sort galerii = natywny DnD.
  css: ['vue-advanced-cropper/dist/style.css'],
  // Porty 52+ — bez konfliktów z innymi projektami lokalnymi.
  devServer: { port: 5200 },
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:5201/api',
      // Slug drzewa ładowanego po zalogowaniu (musi istnieć w bazie).
      treeName: process.env.NUXT_PUBLIC_TREE_NAME || 'szejna',
      // Treści strony publicznej / branding (open source — konfigurowalne).
      appTitle: process.env.NUXT_PUBLIC_APP_TITLE || 'Rodno',
      familyName: process.env.NUXT_PUBLIC_FAMILY_NAME || '',
      tagline: process.env.NUXT_PUBLIC_TAGLINE || 'Rodzinne drzewo genealogiczne',
      description:
        process.env.NUXT_PUBLIC_DESCRIPTION ||
        'Prywatne, rodzinne drzewo genealogiczne. Dostęp wymaga potwierdzenia tożsamości.',
      contactEmail: process.env.NUXT_PUBLIC_CONTACT_EMAIL || '',
    },
  },
  app: {
    head: {
      title: 'Rodno — drzewo rodzinne',
      htmlAttrs: { lang: 'pl' },
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    },
  },
});
