<script setup lang="ts">
import type { PersonCard } from '@rodno/shared';

/** Autocomplete osoby z drzewa (do oznaczania na zdjęciu i chrzestnych). Tag: <PersonPicker>. */
const props = defineProps<{ treeId: string; placeholder?: string }>();
const emit = defineEmits<{ (e: 'select', person: PersonCard): void }>();

const api = useApi();
const q = ref('');
const results = ref<PersonCard[]>([]);
const open = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

watch(q, (val) => {
  if (timer) clearTimeout(timer);
  if (!val.trim()) {
    results.value = [];
    open.value = false;
    return;
  }
  timer = setTimeout(async () => {
    results.value = await api.search(props.treeId, val.trim());
    open.value = results.value.length > 0;
  }, 200);
});

function pick(p: PersonCard) {
  emit('select', p);
  q.value = '';
  results.value = [];
  open.value = false;
}
</script>

<template>
  <div class="relative">
    <input
      v-model="q"
      type="text"
      :placeholder="placeholder || 'Szukaj osoby…'"
      class="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-sky-400 focus:outline-none"
      @focus="open = results.length > 0"
    />
    <ul
      v-if="open"
      class="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
    >
      <li
        v-for="p in results"
        :key="p.id"
        class="cursor-pointer px-3 py-2 text-sm hover:bg-sky-50"
        @click="pick(p)"
      >
        <span class="font-medium text-slate-700">{{ p.name }}</span>
        <span v-if="p.lifespan" class="ml-1.5 text-xs text-slate-400">{{ p.lifespan }}</span>
      </li>
    </ul>
  </div>
</template>
