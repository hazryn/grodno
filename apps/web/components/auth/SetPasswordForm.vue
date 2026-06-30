<script setup lang="ts">
defineProps<{ submitting?: boolean; ctaLabel: string }>();
const emit = defineEmits<{ (e: 'submit', password: string): void }>();

const { t } = useI18n();
const { error } = useToast();
const pw = reactive({ a: '', b: '' });

function submit() {
  if (pw.a.length < 8) {
    error(t('access.password.minLength'));
    return;
  }
  if (pw.a !== pw.b) {
    error(t('access.password.mismatch'));
    return;
  }
  emit('submit', pw.a);
}
</script>

<template>
  <form class="space-y-3" @submit.prevent="submit">
    <input
      v-model="pw.a"
      type="password"
      :placeholder="$t('access.password.newPlaceholder')"
      autocomplete="new-password"
      class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
    />
    <input
      v-model="pw.b"
      type="password"
      :placeholder="$t('access.password.repeatPlaceholder')"
      autocomplete="new-password"
      class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
    />
    <button
      type="submit"
      :disabled="submitting"
      class="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-50"
    >
      {{ submitting ? $t('common.saving') : ctaLabel }}
    </button>
  </form>
</template>
