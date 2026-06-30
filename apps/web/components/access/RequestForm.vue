<script setup lang="ts">
const { requestAccess } = useAuth();
const { success, error } = useToast();

const form = reactive({ firstName: '', lastName: '', email: '' });
const submitting = ref(false);
const done = ref(false);

async function submit() {
  if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
    error('Uzupełnij imię, nazwisko i adres e-mail.');
    return;
  }
  submitting.value = true;
  try {
    await requestAccess(form.firstName.trim(), form.lastName.trim(), form.email.trim());
    done.value = true;
    success('Jeśli adres jest prawidłowy, wysłaliśmy na niego link.');
  } catch {
    error('Nie udało się wysłać prośby. Spróbuj ponownie.');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <div v-if="done" class="text-center">
      <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        ✓
      </div>
      <h3 class="text-base font-semibold text-slate-800">Sprawdź skrzynkę</h3>
      <p class="mt-1 text-sm text-slate-500">
        Jeśli podany adres jest prawidłowy, wysłaliśmy na niego link z dalszymi krokami.
      </p>
      <button
        class="mt-4 text-sm font-medium text-amber-600 hover:text-amber-700"
        @click="done = false"
      >
        Wyślij ponownie
      </button>
    </div>

    <form v-else class="space-y-3" @submit.prevent="submit">
      <h3 class="text-base font-semibold text-slate-800">Poproś o dostęp</h3>
      <p class="text-sm text-slate-500">
        Podaj swoje dane — wyślemy link potwierdzający na e-mail.
      </p>
      <input
        v-model="form.firstName"
        type="text"
        placeholder="Imię"
        autocomplete="given-name"
        class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
      />
      <input
        v-model="form.lastName"
        type="text"
        placeholder="Nazwisko"
        autocomplete="family-name"
        class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
      />
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
        {{ submitting ? 'Wysyłanie…' : 'Wyślij prośbę' }}
      </button>
    </form>
  </div>
</template>
