<script setup lang="ts">
import VueEasyLightbox from 'vue-easy-lightbox';
import { isCoupleEventType, type IndividualDto, type WorkExperience } from '@rodno/shared';

const { t } = useI18n();
const { formatDate, eventLabel } = useDomainLabels();

const props = defineProps<{ individualId: string | null }>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'recenter', id: string): void;
  (e: 'changed', id: string): void;
}>();

const api = useApi();
const data = ref<IndividualDto | null>(null);
const loading = ref(false);
const editing = ref(false);
const avatarModal = ref(false);
const avatarLb = ref(false); // lightbox powiększenia avatara

type EditTab = 'basic' | 'contact' | 'timeline' | 'gallery';
const editTab = ref<EditTab>('basic');
const EDIT_TABS: Array<{ key: EditTab; label: string }> = [
  { key: 'basic', label: 'person.tabs.data' },
  { key: 'contact', label: 'person.tabs.contact' },
  { key: 'timeline', label: 'person.tabs.timeline' },
  { key: 'gallery', label: 'person.tabs.gallery' },
];
// Ikony (stroke) per zakładka — pasek kompaktowy, jedna linia.
const TAB_ICONS: Record<EditTab, string[]> = {
  basic: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6'],
  contact: ['M4 6h16v12H4z', 'm4 8 8 5 8-5'],
  timeline: ['M12 8v4.5l3 1.8', 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z'],
  gallery: ['M4 5h16v14H4z', 'M9 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z', 'm5 18 5-5 4 4 2-2 3 3'],
};

watch(
  () => props.individualId,
  async (id) => {
    data.value = null;
    editing.value = false;
    editTab.value = 'basic';
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

/** Aktualizuje lokalny stan po edycji i informuje rodzica (odświeżenie kafelka w drzewie). */
function onUpdated(updated: IndividualDto) {
  data.value = updated;
  emit('changed', updated.id);
}
function onAvatarSaved(updated: IndividualDto) {
  avatarModal.value = false;
  onUpdated(updated);
}

// zdarzenia pary (ślub itp.) są na ekranie „Dane", nie na osi czasu
const visibleEvents = computed(() => data.value?.events.filter((e) => !isCoupleEventType(e.type)) ?? []);
const ROLE_KEYS: Record<string, string> = {
  godfather: 'timeline.roles.godfather', godmother: 'timeline.roles.godmother', godparent: 'timeline.roles.godparent',
  witness: 'timeline.roles.witness', officiant: 'timeline.roles.officiant', other: 'timeline.roles.other',
};
const roleLabel = (r: string) => (ROLE_KEYS[r] ? t(ROLE_KEYS[r]) : r);
const linkLabel = (l: { label: string | null; url: string }) => {
  if (l.label) return l.label;
  try { return new URL(l.url).hostname.replace(/^www\./, ''); } catch { return l.url; }
};

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? '').join('');
}

function periodText(e: WorkExperience): string {
  if (e.from && e.to) return e.from === e.to ? e.from : t('person.experienceUntil', { from: e.from, to: e.to });
  if (e.from) return t('person.experienceCurrent', { from: e.from });
  if (e.to) return t('person.experienceUntilOnly', { to: e.to });
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
    <div v-if="loading" class="p-10 text-center text-slate-400">{{ $t('person.loading') }}</div>

    <template v-else-if="data">
      <!-- nagłówek -->
      <div class="border-b border-slate-100 p-5">
        <div class="flex flex-wrap items-start gap-x-4 gap-y-3">
        <div class="relative shrink-0">
          <div
            class="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full text-lg font-bold"
            :class="data.sex === 'M' ? 'bg-sky-200 text-sky-800' : data.sex === 'F' ? 'bg-pink-200 text-pink-800' : 'bg-slate-200 text-slate-700'"
          >
            <img
              v-if="data.photoUrl"
              :src="data.photoUrl"
              :alt="data.primaryName"
              class="h-full w-full object-cover"
              :class="{ 'cursor-zoom-in': !editing }"
              @click="!editing && (avatarLb = true)"
            />
            <span v-else>{{ initials(data.primaryName) }}</span>
          </div>
          <button
            v-if="editing"
            class="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-sky-600 text-xs text-white shadow hover:bg-sky-700"
            :title="$t('person.changeAvatar')"
            @click="avatarModal = true"
          >✎</button>
        </div>
        <div class="min-w-0 flex-1">
          <h2 class="text-xl font-bold text-slate-800">{{ data.primaryName }}</h2>
          <p class="text-sm text-slate-500">
            {{ data.birth?.date ? formatDate(data.birth.date) : '?' }}
            <span v-if="data.death"> – {{ data.death?.date ? formatDate(data.death.date) : '?' }}</span>
            <span v-if="data.isLiving" class="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">{{ $t('person.living') }}</span>
          </p>
          <p v-if="data.names.length > 1" class="mt-1 text-xs text-slate-400">
            {{ $t('person.alsoKnownAs', { names: data.names.slice(1).map((n) => n.full).join(', ') }) }}
          </p>
        </div>
        <!-- kontakt / social: pełna szerokość, do lewej -->
        <div v-if="data.linkedinUrl || data.xUrl || data.facebookUrl || data.instagramUrl || data.emails.length" class="order-last mt-1 flex w-full basis-full flex-wrap items-center gap-1.5">
            <a
              v-if="data.facebookUrl"
              :href="data.facebookUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 rounded-md bg-[#1877f2] px-2 py-1 text-xs font-medium text-white transition hover:brightness-110"
              :title="$t('person.social.facebookTitle')"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" class="h-3.5 w-3.5"><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.02 4.39 11.01 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.08 24 18.09 24 12.07z"/></svg>
              {{ $t('person.social.facebook') }}
            </a>
            <a
              v-if="data.linkedinUrl"
              :href="data.linkedinUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 rounded-md bg-[#0a66c2] px-2 py-1 text-xs font-medium text-white transition hover:brightness-110"
              :title="$t('person.social.linkedinTitle')"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" class="h-3.5 w-3.5"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 110-4.13 2.06 2.06 0 010 4.13zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>
              {{ $t('person.social.linkedin') }}
            </a>
            <a
              v-if="data.xUrl"
              :href="data.xUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white transition hover:bg-slate-700"
              :title="$t('person.social.xTitle')"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" class="h-3.5 w-3.5"><path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.46l8.6-9.83L0 1.15h7.6l5.24 6.93 6.06-6.93zm-1.29 19.5h2.04L6.49 3.24H4.3L17.61 20.65z"/></svg>
              {{ $t('person.social.x') }}
            </a>
            <a
              v-if="data.instagramUrl"
              :href="data.instagramUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 rounded-md bg-gradient-to-tr from-amber-500 via-pink-600 to-purple-600 px-2 py-1 text-xs font-medium text-white transition hover:brightness-110"
              :title="$t('person.social.instagramTitle')"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" class="h-3.5 w-3.5"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 01-1.38-.9 3.7 3.7 0 01-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zm0 1.62c-3.15 0-3.52.01-4.76.07-.99.04-1.53.21-1.88.35-.47.18-.81.4-1.17.76-.36.36-.58.7-.76 1.17-.14.35-.31.89-.35 1.88-.06 1.24-.07 1.61-.07 4.76s.01 3.52.07 4.76c.04.99.21 1.53.35 1.88.18.47.4.81.76 1.17.36.36.7.58 1.17.76.35.14.89.31 1.88.35 1.24.06 1.61.07 4.76.07s3.52-.01 4.76-.07c.99-.04 1.53-.21 1.88-.35.47-.18.81-.4 1.17-.76.36-.36.58-.7.76-1.17.14-.35.31-.89.35-1.88.06-1.24.07-1.61.07-4.76s-.01-3.52-.07-4.76c-.04-.99-.21-1.53-.35-1.88a3.15 3.15 0 00-.76-1.17 3.15 3.15 0 00-1.17-.76c-.35-.14-.89-.31-1.88-.35-1.24-.06-1.61-.07-4.76-.07zm0 2.76a5.46 5.46 0 110 10.92 5.46 5.46 0 010-10.92zm0 9a3.54 3.54 0 100-7.08 3.54 3.54 0 000 7.08zm6.95-9.22a1.27 1.27 0 11-2.55 0 1.27 1.27 0 012.55 0z"/></svg>
              {{ $t('person.social.instagram') }}
            </a>
            <a
              v-for="m in data.emails"
              :key="m"
              :href="`mailto:${m}`"
              class="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
              :title="$t('person.social.emailTitle', { email: m })"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3.5 w-3.5"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
              {{ m }}
            </a>
          </div>
        <div class="flex shrink-0 items-center gap-1">
          <button
            class="rounded-lg px-2.5 py-1.5 text-sm font-medium transition"
            :class="editing ? 'bg-sky-600 text-white hover:bg-sky-700' : 'text-sky-700 hover:bg-sky-50'"
            @click="editing = !editing"
          >
            {{ editing ? $t('person.done') : $t('person.edit') }}
          </button>
          <button class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" @click="emit('close')">✕</button>
        </div>
        </div>
      </div>

      <!-- TRYB EDYCJI: taby -->
      <div v-if="editing" class="flex min-h-0 flex-1 flex-col">
        <nav class="grid shrink-0 grid-cols-4 border-b border-slate-100">
          <button
            v-for="t in EDIT_TABS"
            :key="t.key"
            class="flex flex-col items-center gap-1 border-b-2 py-2 text-[11px] font-medium transition"
            :class="editTab === t.key ? 'border-sky-500 text-sky-700' : 'border-transparent text-slate-400 hover:bg-slate-50 hover:text-slate-600'"
            @click="editTab = t.key"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
              <path v-for="(d, i) in TAB_ICONS[t.key]" :key="i" :d="d" />
            </svg>
            <span>{{ $t(t.label) }}</span>
          </button>
        </nav>
        <div class="flex-1 overflow-y-auto p-5">
          <div v-if="editTab === 'basic'" class="space-y-6">
            <PersonEditForm :person="data" section="basic" @saved="onUpdated" />
            <PersonMarriages :person="data" @changed="onUpdated" />
          </div>
          <PersonEditForm v-else-if="editTab === 'contact'" :person="data" section="contact" @saved="onUpdated" />
          <PersonTimelineEditor v-else-if="editTab === 'timeline'" :person="data" @changed="onUpdated" />
          <PersonGallery v-else-if="editTab === 'gallery'" :person="data" @avatar-changed="onUpdated" />
        </div>
      </div>

      <!-- TRYB PODGLĄDU: bio + doświadczenie + oś czasu -->
      <div v-else class="flex-1 space-y-6 overflow-y-auto p-5">
        <!-- nota biograficzna -->
        <section v-if="data.bio">
          <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{{ $t('person.sectionAbout') }}</h3>
          <p class="whitespace-pre-line text-sm leading-relaxed text-slate-600">{{ data.bio }}</p>
        </section>

        <!-- doświadczenie (styl LinkedIn — logo firmy + stanowisko + okres) -->
        <section v-if="data.experience.length">
          <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{{ $t('person.sectionExperience') }}</h3>
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
          <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{{ $t('person.sectionLinks') }}</h3>
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

        <!-- galeria (podgląd: max 2 rzędy + „Otwórz galerię") -->
        <PersonGallery :person="data" preview />

        <!-- oś czasu -->
        <section>
          <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{{ $t('person.sectionTimeline') }}</h3>
          <ol class="relative space-y-3 border-l-2 border-slate-100 pl-5">
            <li v-for="ev in visibleEvents" :key="ev.id" class="relative">
              <span class="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-slate-300"></span>
              <div class="flex flex-wrap items-baseline gap-x-2">
                <span class="text-sm font-medium text-slate-700">{{ eventLabel(ev.type) }}</span>
                <span v-if="ev.date" class="text-xs text-slate-500">{{ formatDate(ev.date) }}</span>
              </div>
              <div v-if="ev.place" class="text-xs text-slate-400">⌖ {{ ev.place.name }}</div>
              <div v-if="ev.value" class="text-xs text-slate-500">{{ ev.value }}</div>
              <ul v-if="ev.participants.length" class="mt-0.5 space-y-0.5">
                <li v-for="p in ev.participants" :key="p.id" class="text-xs text-slate-500">
                  <span class="text-slate-400">{{ roleLabel(p.role) }}:</span>
                  <button
                    v-if="p.individualId"
                    class="ml-1 text-sky-700 hover:underline"
                    @click="emit('recenter', p.individualId)"
                  >{{ p.name || '—' }}</button>
                  <span v-else class="ml-1">{{ p.name || '—' }}</span>
                </li>
              </ul>
            </li>
            <li v-if="!visibleEvents.length" class="text-sm text-slate-400">{{ $t('person.timelineEmpty') }}</li>
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
          {{ $t('person.center') }}
        </button>
      </div>

      <!-- powiększenie avatara -->
      <ClientOnly>
        <VueEasyLightbox :visible="avatarLb" :imgs="data.photoUrl ? [data.photoUrl] : []" @hide="avatarLb = false" />
      </ClientOnly>

      <!-- modal zmiany avatara (z dysku) -->
      <CommonModal :open="avatarModal" :title="$t('person.changeAvatar')" max-width="max-w-lg" :close-on-backdrop="false" @close="avatarModal = false">
        <div class="p-5">
          <PersonAvatarEditor :person="data" @saved="onAvatarSaved" @cancel="avatarModal = false" />
        </div>
      </CommonModal>
    </template>
  </div>
</template>
