<script setup lang="ts">
const config = useRuntimeConfig();
const route = useRoute();
const localePath = useLocalePath();
const { confirm, setSession } = useAuth();

const appTitle = config.public.appTitle as string;
const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''));

// 'form' = ustaw hasło · 'pending' = czeka na admina · 'invalid' = zły/wygasły link
const state = ref<'form' | 'pending' | 'invalid'>(token.value ? 'form' : 'invalid');
const submitting = ref(false);

async function onSubmit(password: string) {
  submitting.value = true;
  try {
    const res = await confirm(token.value, password);
    if (res.status === 'approved') {
      setSession(res.accessToken, res.user);
      await navigateTo(localePath('/tree'));
    } else {
      state.value = 'pending';
    }
  } catch {
    state.value = 'invalid';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gradient-to-b from-amber-50 via-white to-slate-50 px-6">
    <div class="w-full max-w-sm">
      <NuxtLink :to="localePath('/')" class="mb-6 block text-center text-lg font-bold tracking-tight text-amber-500">
        {{ appTitle }}
      </NuxtLink>
      <div class="mb-4 flex justify-center">
        <CommonLanguageSwitcher />
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <template v-if="state === 'form'">
          <h1 class="mb-1 text-base font-semibold text-slate-800">{{ $t('access.confirm.title') }}</h1>
          <p class="mb-4 text-sm text-slate-500">
            {{ $t('access.confirm.description') }}
          </p>
          <AuthSetPasswordForm :cta-label="$t('access.confirm.cta')" :submitting="submitting" @submit="onSubmit" />
        </template>

        <div v-else-if="state === 'pending'" class="text-center">
          <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            ⏳
          </div>
          <h1 class="text-base font-semibold text-slate-800">{{ $t('access.confirm.pendingTitle') }}</h1>
          <p class="mt-1 text-sm text-slate-500">
            {{ $t('access.confirm.pendingMessage') }}
          </p>
        </div>

        <div v-else class="text-center">
          <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            ✕
          </div>
          <h1 class="text-base font-semibold text-slate-800">{{ $t('access.confirm.invalidTitle') }}</h1>
          <p class="mt-1 text-sm text-slate-500">
            {{ $t('access.confirm.invalidMessage') }}
          </p>
          <NuxtLink
            :to="localePath('/')"
            class="mt-4 inline-block rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
          >
            {{ $t('access.confirm.invalidCta') }}
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
