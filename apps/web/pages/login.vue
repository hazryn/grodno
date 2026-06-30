<script setup lang="ts">
definePageMeta({ middleware: 'guest' });

const { t } = useI18n();
const localePath = useLocalePath();
const config = useRuntimeConfig();
const route = useRoute();
const { login, forgot } = useAuth();
const { success, error } = useToast();

const appTitle = config.public.appTitle as string;

const mode = ref<'login' | 'forgot'>('login');
const form = reactive({ email: '', password: '' });
const submitting = ref(false);

async function onLogin() {
  submitting.value = true;
  try {
    await login(form.email.trim(), form.password);
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/tree';
    await navigateTo(redirect);
  } catch (e: any) {
    error(e?.data?.message || t('login.errorInvalid'));
  } finally {
    submitting.value = false;
  }
}

async function onForgot() {
  if (!form.email.trim()) {
    error(t('login.errorEmailRequired'));
    return;
  }
  submitting.value = true;
  try {
    await forgot(form.email.trim());
    success(t('login.forgotSuccess'));
    mode.value = 'login';
  } catch {
    error(t('login.forgotError'));
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gradient-to-b from-amber-50 via-white to-slate-50 px-6">
    <div class="w-full max-w-sm">
      <div class="mb-4 flex justify-end">
        <CommonLanguageSwitcher />
      </div>
      <NuxtLink :to="localePath('/')" class="mb-6 block text-center text-lg font-bold tracking-tight text-amber-500">
        {{ appTitle }}
      </NuxtLink>

      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <!-- logowanie -->
        <form v-if="mode === 'login'" class="space-y-3" @submit.prevent="onLogin">
          <h1 class="text-base font-semibold text-slate-800">{{ $t('login.title') }}</h1>
          <input
            v-model="form.email"
            type="email"
            :placeholder="$t('login.emailPlaceholder')"
            autocomplete="email"
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          />
          <input
            v-model="form.password"
            type="password"
            :placeholder="$t('login.passwordPlaceholder')"
            autocomplete="current-password"
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          />
          <button
            type="submit"
            :disabled="submitting"
            class="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-50"
          >
            {{ submitting ? $t('login.submitting') : $t('login.submit') }}
          </button>
          <div class="flex items-center justify-between pt-1 text-sm">
            <NuxtLink :to="localePath('/')" class="text-slate-400 hover:text-slate-600">{{ $t('login.requestAccess') }}</NuxtLink>
            <button type="button" class="text-amber-600 hover:text-amber-700" @click="mode = 'forgot'">
              {{ $t('login.forgotLink') }}
            </button>
          </div>
        </form>

        <!-- przypomnienie hasła -->
        <form v-else class="space-y-3" @submit.prevent="onForgot">
          <h1 class="text-base font-semibold text-slate-800">{{ $t('login.forgotTitle') }}</h1>
          <p class="text-sm text-slate-500">{{ $t('login.forgotDescription') }}</p>
          <input
            v-model="form.email"
            type="email"
            :placeholder="$t('login.emailPlaceholder')"
            autocomplete="email"
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          />
          <button
            type="submit"
            :disabled="submitting"
            class="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-50"
          >
            {{ submitting ? $t('login.forgotSubmitting') : $t('login.forgotSubmit') }}
          </button>
          <button
            type="button"
            class="w-full pt-1 text-center text-sm text-slate-400 hover:text-slate-600"
            @click="mode = 'login'"
          >
            {{ $t('login.backToLogin') }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
