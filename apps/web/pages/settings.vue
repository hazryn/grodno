<script setup lang="ts">
definePageMeta({ middleware: ['auth'] });

const { user, updateLocale } = useAuth();
const { locale, locales, t } = useI18n();
const switchLocalePath = useSwitchLocalePath();
const localePath = useLocalePath();
const { success, error } = useToast();
const config = useRuntimeConfig();

const items = computed(() => locales.value as Array<{ code: string; name: string }>);
const saving = ref(false);

async function choose(code: string) {
  saving.value = true;
  try {
    await updateLocale(code);
    success(t('settings.saved'));
    if (code !== locale.value) await navigateTo(switchLocalePath(code));
  } catch {
    error(t('settings.error'));
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <header class="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3 shadow-sm">
      <span class="text-lg font-bold tracking-tight text-amber-500">{{ config.public.appTitle }}</span>
      <NuxtLink
        :to="localePath('/tree')"
        class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50"
      >
        {{ t('settings.back') }}
      </NuxtLink>
    </header>

    <main class="mx-auto max-w-xl px-6 py-8 space-y-6">
      <h1 class="text-xl font-bold tracking-tight text-slate-800">{{ t('settings.title') }}</h1>

      <section class="rounded-xl border border-slate-200 bg-white p-5">
        <h2 class="mb-3 text-sm font-semibold text-slate-700">{{ t('settings.account') }}</h2>
        <dl class="space-y-2 text-sm">
          <div class="flex justify-between gap-4">
            <dt class="text-slate-400">{{ t('settings.email') }}</dt>
            <dd class="truncate text-slate-700">{{ user?.email }}</dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-slate-400">{{ t('settings.displayName') }}</dt>
            <dd class="truncate text-slate-700">{{ user?.displayName }}</dd>
          </div>
        </dl>
      </section>

      <section class="rounded-xl border border-slate-200 bg-white p-5">
        <h2 class="text-sm font-semibold text-slate-700">{{ t('settings.language') }}</h2>
        <p class="mb-3 text-xs text-slate-400">{{ t('settings.languageHint') }}</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="l in items"
            :key="l.code"
            type="button"
            :disabled="saving"
            class="rounded-lg border px-4 py-2 text-sm font-medium transition disabled:opacity-50"
            :class="l.code === locale
              ? 'border-amber-300 bg-amber-50 text-amber-700'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'"
            @click="choose(l.code)"
          >
            {{ l.name }}
          </button>
        </div>
      </section>
    </main>
  </div>
</template>
