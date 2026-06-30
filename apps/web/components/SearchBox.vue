<script setup lang="ts">
import type { PersonCard } from '@rodno/shared';

const props = defineProps<{ treeId: string }>();
const emit = defineEmits<{ (e: 'select', id: string): void }>();

const api = useApi();
const q = ref('');
const results = ref<PersonCard[]>([]);
const open = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

watch(q, (value) => {
  if (timer) clearTimeout(timer);
  if (value.trim().length < 2) {
    results.value = [];
    open.value = false;
    return;
  }
  timer = setTimeout(async () => {
    results.value = await api.search(props.treeId, value.trim());
    open.value = true;
  }, 220);
});

function pick(id: string) {
  emit('select', id);
  q.value = '';
  results.value = [];
  open.value = false;
}
</script>

<template>
  <div class="relative w-72">
    <input
      v-model="q"
      type="text"
      placeholder="Szukaj osoby…"
      class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
      @focus="open = results.length > 0"
    />
    <div
      v-if="open && results.length"
      class="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl"
    >
      <button
        v-for="r in results"
        :key="r.id"
        class="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
        @click="pick(r.id)"
      >
        <span
          class="h-2 w-2 shrink-0 rounded-full"
          :class="r.sex === 'M' ? 'bg-sky-400' : r.sex === 'F' ? 'bg-pink-400' : 'bg-slate-400'"
        ></span>
        <span class="min-w-0 flex-1 truncate text-sm text-slate-700">{{ r.displayName || r.name }}</span>
        <span class="shrink-0 text-xs text-slate-400">{{ r.lifespan || '' }}</span>
      </button>
    </div>
    <div
      v-else-if="open && q.trim().length >= 2"
      class="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 shadow-xl"
    >
      Brak wyników.
    </div>
  </div>
</template>
