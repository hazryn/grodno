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
const errors = reactive({ email: '', password: '' });
const formError = ref('');
const submitting = ref(false);

function switchMode(m: 'login' | 'forgot'): void {
  mode.value = m;
  errors.email = '';
  errors.password = '';
  formError.value = '';
}

function emailValid(v: string): boolean {
  return /.+@.+\..+/.test(v);
}
function validateEmail(): string {
  if (!form.email.trim()) return t('login.errorEmailRequired');
  if (!emailValid(form.email.trim())) return t('login.errorEmailInvalid');
  return '';
}

async function onLogin() {
  formError.value = '';
  errors.email = validateEmail();
  errors.password = form.password ? '' : t('login.errorPasswordRequired');
  if (errors.email || errors.password) return;

  submitting.value = true;
  try {
    await login(form.email.trim(), form.password);
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/tree';
    await navigateTo(redirect);
  } catch {
    // Nigdy nie pokazujemy surowych komunikatów walidatora z API — tylko zlokalizowane.
    formError.value = t('login.errorInvalid');
  } finally {
    submitting.value = false;
  }
}

async function onForgot() {
  errors.email = validateEmail();
  if (errors.email) return;
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
        <form v-if="mode === 'login'" class="space-y-3" novalidate @submit.prevent="onLogin">
          <h1 class="text-base font-semibold text-slate-800">{{ $t('login.title') }}</h1>
          <div>
            <input
              v-model="form.email"
              type="email"
              :placeholder="$t('login.emailPlaceholder')"
              autocomplete="email"
              :aria-invalid="!!errors.email || undefined"
              class="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
              :class="errors.email
                ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100'
                : 'border-slate-200 focus:border-amber-400 focus:ring-amber-100'"
              @input="errors.email = ''; formError = ''"
            />
            <p v-if="errors.email" class="mt-1 text-xs text-rose-600">{{ errors.email }}</p>
          </div>
          <div>
            <CommonPasswordInput
              v-model="form.password"
              :placeholder="$t('login.passwordPlaceholder')"
              autocomplete="current-password"
              :invalid="!!errors.password"
              @update:model-value="errors.password = ''; formError = ''"
            />
            <p v-if="errors.password" class="mt-1 text-xs text-rose-600">{{ errors.password }}</p>
          </div>
          <p v-if="formError" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
            {{ formError }}
          </p>
          <button
            type="submit"
            :disabled="submitting"
            class="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-50"
          >
            {{ submitting ? $t('login.submitting') : $t('login.submit') }}
          </button>
          <div class="flex items-center justify-between pt-1 text-sm">
            <NuxtLink :to="localePath('/')" class="text-slate-400 hover:text-slate-600">{{ $t('login.requestAccess') }}</NuxtLink>
            <button type="button" class="text-amber-600 hover:text-amber-700" @click="switchMode('forgot')">
              {{ $t('login.forgotLink') }}
            </button>
          </div>
        </form>

        <!-- przypomnienie hasła -->
        <form v-else class="space-y-3" novalidate @submit.prevent="onForgot">
          <h1 class="text-base font-semibold text-slate-800">{{ $t('login.forgotTitle') }}</h1>
          <p class="text-sm text-slate-500">{{ $t('login.forgotDescription') }}</p>
          <div>
            <input
              v-model="form.email"
              type="email"
              :placeholder="$t('login.emailPlaceholder')"
              autocomplete="email"
              :aria-invalid="!!errors.email || undefined"
              class="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
              :class="errors.email
                ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100'
                : 'border-slate-200 focus:border-amber-400 focus:ring-amber-100'"
              @input="errors.email = ''"
            />
            <p v-if="errors.email" class="mt-1 text-xs text-rose-600">{{ errors.email }}</p>
          </div>
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
            @click="switchMode('login')"
          >
            {{ $t('login.backToLogin') }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
