<script setup lang="ts">
import { formatGedcomDatePl, type IndividualDto, type EventDto, type WorkExperience } from '@rodno/shared';

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
const linkLabel = (l: { label: string | null; url: string }) => {
  if (l.label) return l.label;
  try { return new URL(l.url).hostname.replace(/^www\./, ''); } catch { return l.url; }
};

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? '').join('');
}

function periodText(e: WorkExperience): string {
  if (e.from && e.to) return e.from === e.to ? e.from : `${e.from} – ${e.to}`;
  if (e.from) return `${e.from} – obecnie`;
  if (e.to) return `do ${e.to}`;
  return '';
}
function companyInitial(e: WorkExperience): string {
  return (e.company || e.title || '?').trim()[0]?.toUpperCase() ?? '?';
}
// Favicony firm bywają puste/404 — chowamy zepsute i pokazujemy inicjał.
const brokenLogos = ref<Set<number>>(new Set());
function onLogoError(i: number) {
  brokenLogos.value = new Set(brokenLogos.value).add(i);
}
watch(() => props.individualId, () => (brokenLogos.value = new Set()));
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
          <!-- kontakt / social -->
          <div v-if="data.linkedinUrl || data.xUrl || data.facebookUrl || data.emails.length" class="mt-2 flex flex-wrap items-center gap-1.5">
            <a
              v-if="data.facebookUrl"
              :href="data.facebookUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 rounded-md bg-[#1877f2] px-2 py-1 text-xs font-medium text-white transition hover:brightness-110"
              title="Profil Facebook"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" class="h-3.5 w-3.5"><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.02 4.39 11.01 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.08 24 18.09 24 12.07z"/></svg>
              Facebook
            </a>
            <a
              v-if="data.linkedinUrl"
              :href="data.linkedinUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 rounded-md bg-[#0a66c2] px-2 py-1 text-xs font-medium text-white transition hover:brightness-110"
              title="Profil LinkedIn"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" class="h-3.5 w-3.5"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 110-4.13 2.06 2.06 0 010 4.13zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>
              LinkedIn
            </a>
            <a
              v-if="data.xUrl"
              :href="data.xUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white transition hover:bg-slate-700"
              title="Profil X"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" class="h-3.5 w-3.5"><path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.46l8.6-9.83L0 1.15h7.6l5.24 6.93 6.06-6.93zm-1.29 19.5h2.04L6.49 3.24H4.3L17.61 20.65z"/></svg>
              X
            </a>
            <a
              v-for="m in data.emails"
              :key="m"
              :href="`mailto:${m}`"
              class="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
              :title="`Napisz: ${m}`"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3.5 w-3.5"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
              {{ m }}
            </a>
          </div>
        </div>
        <button class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" @click="emit('close')">✕</button>
      </div>

      <!-- treść przewijalna: bio + doświadczenie + oś czasu -->
      <div class="flex-1 space-y-6 overflow-y-auto p-5">
        <!-- nota biograficzna -->
        <section v-if="data.bio">
          <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">O osobie</h3>
          <p class="whitespace-pre-line text-sm leading-relaxed text-slate-600">{{ data.bio }}</p>
        </section>

        <!-- doświadczenie (styl LinkedIn — logo firmy + stanowisko + okres) -->
        <section v-if="data.experience.length">
          <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Doświadczenie</h3>
          <ul class="space-y-3.5">
            <li v-for="(x, i) in data.experience" :key="i" class="flex gap-3">
              <div class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-400">
                <img
                  v-if="x.logoUrl && !brokenLogos.has(i)"
                  :src="x.logoUrl"
                  :alt="x.company || x.title"
                  class="h-6 w-6 object-contain"
                  @error="onLogoError(i)"
                />
                <span v-else>{{ companyInitial(x) }}</span>
              </div>
              <div class="min-w-0">
                <div class="text-sm font-semibold leading-tight text-slate-800">{{ x.title }}</div>
                <div v-if="x.company" class="text-sm leading-tight text-slate-600">{{ x.company }}</div>
                <div v-if="periodText(x)" class="mt-0.5 text-xs text-slate-400">{{ periodText(x) }}</div>
              </div>
            </li>
          </ul>
        </section>

        <!-- linki zewnętrzne (nekrologi, strony pamięci, Grobonet, Find a Grave...) -->
        <section v-if="data.links.length">
          <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Linki</h3>
          <ul class="space-y-1.5">
            <li v-for="(l, i) in data.links" :key="i">
              <a
                :href="l.url"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1.5 text-sm text-sky-700 hover:underline"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3.5 w-3.5 shrink-0"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                {{ linkLabel(l) }}
              </a>
            </li>
          </ul>
        </section>

        <!-- oś czasu -->
        <section>
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
        </section>
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
