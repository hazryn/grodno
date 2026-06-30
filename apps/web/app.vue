<script setup lang="ts">
// <html lang> + linki hreflang per locale (@nuxtjs/i18n).
const head = useLocaleHead();
useHead(head);
</script>

<template>
  <NuxtPage />
  <CommonToaster />
  <CommonConfirmDialog />
</template>
