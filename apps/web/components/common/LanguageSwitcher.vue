<script setup lang="ts">
const { locale, locales } = useI18n();
const switchLocalePath = useSwitchLocalePath();
const { isLoggedIn, updateLocale } = useAuth();

const items = computed(() => locales.value as Array<{ code: string; name?: string }>);

async function onSwitch(code: string) {
  if (code === locale.value) return;
  // Zalogowanym zapisujemy wybór na koncie (używany też do maili).
  if (isLoggedIn.value) {
    try {
      await updateLocale(code);
    } catch {
      /* ignoruj — i tak przełączymy interfejs */
    }
  }
  await navigateTo(switchLocalePath(code));
}
</script>

<template>
  <div class="flex items-center gap-0.5 rounded-lg border border-slate-200 p-0.5">
    <button
      v-for="l in items"
      :key="l.code"
      type="button"
      class="rounded-md px-2 py-1 text-xs font-semibold uppercase transition"
      :class="l.code === locale ? 'bg-amber-100 text-amber-700' : 'text-slate-400 hover:bg-slate-50'"
      @click="onSwitch(l.code)"
    >
      {{ l.code }}
    </button>
  </div>
</template>
