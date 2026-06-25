<script setup lang="ts">
import { formatGedcomDatePl, type IndividualDto, type EventDto } from '@rodno/shared';

const props = defineProps<{ individualId: string | null }>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'recenter', id: string): void;
}>();

const api = useApi();
const data = ref<IndividualDto | null>(null);
const loading = ref(false);

watch(
  () => props.individualId,
  async (id) => {
    data.value = null;
    if (!id) return;
    loading.value = true;
    try {
      const result = await api.individual(id);
      if (props.individualId === id) data.value = result;
    } finally {
      if (props.individualId === id) loading.value = false;
    }
  },
  { immediate: true },
);

const EVENT_LABELS: Record<string, string> = {
  BIRT: 'Urodziny', DEAT: 'Zgon', BURI: 'Pogrzeb', CREM: 'Kremacja',
  BAPM: 'Chrzest', CHR: 'Chrzest', MARR: 'Ślub', DIV: 'Rozwód',
  RESI: 'Zamieszkanie', OCCU: 'Zawód', EDUC: 'Edukacja', GRAD: 'Ukończenie szkoły',
  RETI: 'Emerytura', CENS: 'Spis ludności', IMMI: 'Imigracja', EMIG: 'Emigracja',
  NATU: 'Naturalizacja', RELI: 'Religia', DSCR: 'Opis', EVEN: 'Wydarzenie',
};
const eventLabel = (e: EventDto) => EVENT_LABELS[e.type] ?? e.type;

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? '').join('');
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div v-if="loading" class="p-10 text-center text-slate-400">Wczytywanie…</div>

    <template v-else-if="data">
      <!-- nagłówek -->
      <div class="flex items-start gap-4 border-b border-slate-100 p-5">
        <div
          class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-lg font-bold"
          :class="data.sex === 'M' ? 'bg-sky-200 text-sky-800' : data.sex === 'F' ? 'bg-pink-200 text-pink-800' : 'bg-slate-200 text-slate-700'"
        >
          <img v-if="data.photoUrl" :src="data.photoUrl" :alt="data.primaryName" class="h-full w-full object-cover" />
          <span v-else>{{ initials(data.primaryName) }}</span>
        </div>
        <div class="min-w-0 flex-1">
          <h2 class="text-xl font-bold text-slate-800">{{ data.primaryName }}</h2>
          <p class="text-sm text-slate-500">
            {{ data.birth?.date ? formatGedcomDatePl(data.birth.date) : '?' }}
            <span v-if="data.death"> – {{ data.death?.date ? formatGedcomDatePl(data.death.date) : '?' }}</span>
            <span v-if="data.isLiving" class="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">żyje</span>
          </p>
          <p v-if="data.names.length > 1" class="mt-1 text-xs text-slate-400">
            także: {{ data.names.slice(1).map((n) => n.full).join(', ') }}
          </p>
        </div>
        <button class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" @click="emit('close')">✕</button>
      </div>

      <!-- oś czasu -->
      <div class="flex-1 overflow-y-auto p-5">
        <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Oś czasu</h3>
        <ol class="relative space-y-3 border-l-2 border-slate-100 pl-5">
          <li v-for="ev in data.events" :key="ev.id" class="relative">
            <span class="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-slate-300"></span>
            <div class="flex flex-wrap items-baseline gap-x-2">
              <span class="text-sm font-medium text-slate-700">{{ eventLabel(ev) }}</span>
              <span v-if="ev.date" class="text-xs text-slate-500">{{ formatGedcomDatePl(ev.date) }}</span>
            </div>
            <div v-if="ev.place" class="text-xs text-slate-400">⌖ {{ ev.place.name }}</div>
            <div v-if="ev.value" class="text-xs text-slate-500">{{ ev.value }}</div>
          </li>
          <li v-if="!data.events.length" class="text-sm text-slate-400">Brak zdarzeń.</li>
        </ol>
      </div>

      <!-- stopka -->
      <div class="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
        <span class="font-mono text-xs text-slate-400">{{ data.xref }}</span>
        <button
          class="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600"
          @click="emit('recenter', data.id)"
        >
          ⌖ Centruj w drzewie
        </button>
      </div>
    </template>
  </div>
</template>
