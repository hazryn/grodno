<script setup lang="ts">
// <html lang> + linki hreflang per locale (@nuxtjs/i18n).
const head = useLocaleHead();
useHead(head);
const { isLoggedIn } = useAuth();
</script>

<template>
  <NuxtPage />
  <CommonToaster />
  <CommonConfirmDialog />
  <ClientOnly>
    <ChatDock v-if="isLoggedIn" />
  </ClientOnly>
</template>
