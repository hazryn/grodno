<script setup lang="ts">
defineProps<{ submitting?: boolean; ctaLabel: string }>();
const emit = defineEmits<{ (e: 'submit', password: string): void }>();

const { error } = useToast();
const pw = reactive({ a: '', b: '' });

function submit() {
  if (pw.a.length < 8) {
    error('Hasło musi mieć co najmniej 8 znaków.');
    return;
  }
  if (pw.a !== pw.b) {
    error('Hasła nie są takie same.');
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
      placeholder="Nowe hasło (min. 8 znaków)"
      autocomplete="new-password"
      class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
    />
    <input
      v-model="pw.b"
      type="password"
      placeholder="Powtórz hasło"
      autocomplete="new-password"
      class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
    />
    <button
      type="submit"
      :disabled="submitting"
      class="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-50"
    >
      {{ submitting ? 'Zapisywanie…' : ctaLabel }}
    </button>
  </form>
</template>
