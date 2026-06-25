// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  modules: ['@nuxtjs/tailwindcss'],
  // Porty 52+ — bez konfliktów z innymi projektami lokalnymi.
  devServer: { port: 5200 },
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:5201/api',
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
