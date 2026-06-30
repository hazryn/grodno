<script setup lang="ts">
definePageMeta({ middleware: 'guest' });

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
    error(e?.data?.message || 'Błędny e-mail lub hasło.');
  } finally {
    submitting.value = false;
  }
}

async function onForgot() {
  if (!form.email.trim()) {
    error('Podaj adres e-mail.');
    return;
  }
  submitting.value = true;
  try {
    await forgot(form.email.trim());
    success('Jeśli konto istnieje, wysłaliśmy link do zmiany hasła.');
    mode.value = 'login';
  } catch {
    error('Nie udało się wysłać linku. Spróbuj ponownie.');
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
        <!-- logowanie -->
        <form v-if="mode === 'login'" class="space-y-3" @submit.prevent="onLogin">
          <h1 class="text-base font-semibold text-slate-800">Zaloguj się</h1>
          <input
            v-model="form.email"
            type="email"
            placeholder="adres@e-mail.pl"
            autocomplete="email"
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          />
          <input
            v-model="form.password"
            type="password"
            placeholder="Hasło"
            autocomplete="current-password"
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          />
          <button
            type="submit"
            :disabled="submitting"
            class="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-50"
          >
            {{ submitting ? 'Logowanie…' : 'Zaloguj się' }}
          </button>
          <div class="flex items-center justify-between pt-1 text-sm">
            <NuxtLink to="/" class="text-slate-400 hover:text-slate-600">Poproś o dostęp</NuxtLink>
            <button type="button" class="text-amber-600 hover:text-amber-700" @click="mode = 'forgot'">
              Nie pamiętam hasła
            </button>
          </div>
        </form>

        <!-- przypomnienie hasła -->
        <form v-else class="space-y-3" @submit.prevent="onForgot">
          <h1 class="text-base font-semibold text-slate-800">Reset hasła</h1>
          <p class="text-sm text-slate-500">Wyślemy link do ustawienia nowego hasła.</p>
          <input
            v-model="form.email"
            type="email"
            placeholder="adres@e-mail.pl"
            autocomplete="email"
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          />
          <button
            type="submit"
            :disabled="submitting"
            class="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-50"
          >
            {{ submitting ? 'Wysyłanie…' : 'Wyślij link' }}
          </button>
          <button
            type="button"
            class="w-full pt-1 text-center text-sm text-slate-400 hover:text-slate-600"
            @click="mode = 'login'"
          >
            ← Wróć do logowania
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
