<script setup lang="ts">
const { t, locale } = useI18n();
const { requestAccess } = useAuth();
const { success, error } = useToast();

const form = reactive({ firstName: '', lastName: '', email: '' });
const submitting = ref(false);
const done = ref(false);

async function submit() {
  if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
    error(t('access.request.errorValidation'));
    return;
  }
  submitting.value = true;
  try {
    await requestAccess(form.firstName.trim(), form.lastName.trim(), form.email.trim(), locale.value);
    done.value = true;
    success(t('access.request.successToast'));
  } catch {
    error(t('access.request.errorToast'));
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
      <h3 class="text-base font-semibold text-slate-800">{{ $t('access.request.doneTitle') }}</h3>
      <p class="mt-1 text-sm text-slate-500">
        {{ $t('access.request.doneMessage') }}
      </p>
      <button
        class="mt-4 text-sm font-medium text-amber-600 hover:text-amber-700"
        @click="done = false"
      >
        {{ $t('access.request.resend') }}
      </button>
    </div>

    <form v-else class="space-y-3" @submit.prevent="submit">
      <h3 class="text-base font-semibold text-slate-800">{{ $t('access.request.title') }}</h3>
      <p class="text-sm text-slate-500">
        {{ $t('access.request.description') }}
      </p>
      <input
        v-model="form.firstName"
        type="text"
        :placeholder="$t('access.request.firstName')"
        autocomplete="given-name"
        class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
      />
      <input
        v-model="form.lastName"
        type="text"
        :placeholder="$t('access.request.lastName')"
        autocomplete="family-name"
        class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
      />
      <input
        v-model="form.email"
        type="email"
        :placeholder="$t('access.request.email')"
        autocomplete="email"
        class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
      />
      <button
        type="submit"
        :disabled="submitting"
        class="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-50"
      >
        {{ submitting ? $t('access.request.submitting') : $t('access.request.submit') }}
      </button>
    </form>
  </div>
</template>
