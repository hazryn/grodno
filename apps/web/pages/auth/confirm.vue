<script setup lang="ts">
const config = useRuntimeConfig();
const route = useRoute();
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
      await navigateTo('/tree');
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
      <NuxtLink to="/" class="mb-6 block text-center text-lg font-bold tracking-tight text-amber-500">
        {{ appTitle }}
      </NuxtLink>

      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <template v-if="state === 'form'">
          <h1 class="mb-1 text-base font-semibold text-slate-800">Ustaw hasło</h1>
          <p class="mb-4 text-sm text-slate-500">
            Potwierdź adres e-mail i ustaw hasło do swojego konta.
          </p>
          <AuthSetPasswordForm cta-label="Potwierdź i ustaw hasło" :submitting="submitting" @submit="onSubmit" />
        </template>

        <div v-else-if="state === 'pending'" class="text-center">
          <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            ⏳
          </div>
          <h1 class="text-base font-semibold text-slate-800">Konto czeka na zatwierdzenie</h1>
          <p class="mt-1 text-sm text-slate-500">
            Twój adres został potwierdzony. Administrator przypisze Cię do osoby w drzewie i powiadomi
            Cię mailem, gdy dostęp będzie gotowy.
          </p>
        </div>

        <div v-else class="text-center">
          <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            ✕
          </div>
          <h1 class="text-base font-semibold text-slate-800">Link nieprawidłowy</h1>
          <p class="mt-1 text-sm text-slate-500">
            Ten link jest nieprawidłowy lub wygasł. Poproś o dostęp ponownie.
          </p>
          <NuxtLink
            to="/"
            class="mt-4 inline-block rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
          >
            Poproś o dostęp
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
