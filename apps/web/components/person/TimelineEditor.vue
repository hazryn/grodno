<script setup lang="ts">
import {
  EVENT_TYPE_CATALOG,
  EVENT_CATEGORY_LABELS_PL,
  eventTypeLabelPl,
  eventTypeHasParticipants,
  isCoupleEventType,
  formatGedcomDatePl,
  type EventCategory,
  type EventDto,
  type GedcomDateValue,
  type IndividualDto,
} from '@rodno/shared';
import type { EventPatch } from '~/composables/useApi';

/** Edytowalna oś czasu: dodaj/edytuj/usuń zdarzenia + uczestnicy (chrzestni). Tag: <PersonTimelineEditor>. */
const props = defineProps<{ person: IndividualDto }>();
const emit = defineEmits<{ (e: 'changed', person: IndividualDto): void }>();

const api = useApi();
const { success, error } = useToast();
const { ask } = useConfirm();

// zdarzenia pary (ślub/rozwód) są na ekranie „Dane", nie na osi czasu
const events = ref<EventDto[]>(props.person.events.filter((e) => !isCoupleEventType(e.type)));
watch(() => props.person.events, (v) => (events.value = v.filter((e) => !isCoupleEventType(e.type))));

const ROLES: Array<{ value: string; label: string }> = [
  { value: 'godfather', label: 'Ojciec chrzestny' },
  { value: 'godmother', label: 'Matka chrzestna' },
  { value: 'godparent', label: 'Chrzestny/a' },
  { value: 'witness', label: 'Świadek' },
  { value: 'officiant', label: 'Celebrans' },
  { value: 'other', label: 'Inny' },
];
const roleLabel = (r: string) => ROLES.find((x) => x.value === r)?.label ?? r;

// kategorie do pickera typu
const categories = computed(() => {
  const groups: Array<{ key: EventCategory; label: string; items: typeof EVENT_TYPE_CATALOG }> = [];
  for (const def of EVENT_TYPE_CATALOG) {
    if (def.hidden) continue; // np. CHR — duplikat „Chrzest", tylko do etykiet
    if (def.category === 'family') continue; // ślub/rozwód → ekran „Dane"
    let g = groups.find((x) => x.key === def.category);
    if (!g) {
      g = { key: def.category, label: EVENT_CATEGORY_LABELS_PL[def.category], items: [] };
      groups.push(g);
    }
    g.items.push(def);
  }
  return groups;
});

// formularz dodaj/edytuj
interface DraftParticipant { individualId: string | null; name: string | null; role: string }
const editingId = ref<string | null>(null);
const showForm = ref(false);
const fType = ref('BIRT');
const fDate = ref<GedcomDateValue | null>(null);
const fPlace = ref('');
const fValue = ref('');
const fParticipants = ref<DraftParticipant[]>([]);
const saving = ref(false);

const supportsParticipants = computed(() => eventTypeHasParticipants(fType.value));

function openAdd() {
  editingId.value = null;
  fType.value = 'BIRT';
  fDate.value = null;
  fPlace.value = '';
  fValue.value = '';
  fParticipants.value = [];
  showForm.value = true;
}
function openEdit(ev: EventDto) {
  editingId.value = ev.id;
  fType.value = ev.type;
  fDate.value = ev.date;
  fPlace.value = ev.place?.name ?? '';
  fValue.value = ev.value ?? '';
  fParticipants.value = ev.participants.map((p) => ({ individualId: p.individualId, name: p.name, role: p.role }));
  showForm.value = true;
}

function addParticipant() {
  fParticipants.value = [...fParticipants.value, { individualId: null, name: null, role: 'godfather' }];
}
function removeParticipant(i: number) {
  fParticipants.value = fParticipants.value.filter((_, idx) => idx !== i);
}

async function refresh() {
  const person = await api.individual(props.person.id);
  events.value = [...person.events];
  emit('changed', person);
}

async function save() {
  saving.value = true;
  try {
    const body: EventPatch = {
      type: fType.value,
      date: fDate.value,
      placeName: fPlace.value.trim() || null,
      value: fValue.value.trim() || null,
      participants: supportsParticipants.value
        ? fParticipants.value.filter((p) => p.individualId || p.name)
        : [],
    };
    if (editingId.value) await api.patchEvent(editingId.value, body);
    else await api.addEvent(props.person.id, body);
    await refresh();
    success('Zapisano zdarzenie.');
    showForm.value = false;
  } catch {
    error('Nie udało się zapisać zdarzenia.');
  } finally {
    saving.value = false;
  }
}

async function remove(ev: EventDto) {
  const ok = await ask({ title: 'Usunąć zdarzenie?', message: eventTypeLabelPl(ev.type), confirmLabel: 'Usuń', danger: true });
  if (!ok) return;
  try {
    await api.deleteEvent(ev.id);
    await refresh();
    success('Zdarzenie usunięte.');
  } catch {
    error('Nie udało się usunąć.');
  }
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">Oś czasu</span>
      <button class="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700" @click="openAdd">+ Dodaj zdarzenie</button>
    </div>

    <ol class="relative space-y-3 border-l-2 border-slate-100 pl-5">
      <li v-for="ev in events" :key="ev.id" class="group relative">
        <span class="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-slate-300"></span>
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="flex flex-wrap items-baseline gap-x-2">
              <span class="text-sm font-medium text-slate-700">{{ eventTypeLabelPl(ev.type) }}</span>
              <span v-if="ev.date" class="text-xs text-slate-500">{{ formatGedcomDatePl(ev.date) }}</span>
            </div>
            <div v-if="ev.place" class="text-xs text-slate-400">⌖ {{ ev.place.name }}</div>
            <div v-if="ev.value" class="text-xs text-slate-500">{{ ev.value }}</div>
            <div v-if="ev.participants.length" class="mt-0.5 text-xs text-slate-500">
              <span v-for="(p, i) in ev.participants" :key="p.id">
                <span class="text-slate-400">{{ roleLabel(p.role) }}:</span> {{ p.name || '—' }}<span v-if="i < ev.participants.length - 1">, </span>
              </span>
            </div>
          </div>
          <div class="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
            <button class="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100" @click="openEdit(ev)">✎</button>
            <button class="rounded px-1.5 py-0.5 text-xs text-rose-500 hover:bg-rose-50" @click="remove(ev)">✕</button>
          </div>
        </div>
      </li>
      <li v-if="!events.length" class="text-sm text-slate-400">Brak zdarzeń.</li>
    </ol>

    <!-- formularz zdarzenia -->
    <CommonModal :open="showForm" :title="editingId ? 'Edytuj zdarzenie' : 'Dodaj zdarzenie'" max-width="max-w-md" :close-on-backdrop="false" @close="showForm = false">
      <div class="space-y-3 p-5">
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-500">Typ</span>
          <select v-model="fType" class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
            <optgroup v-for="g in categories" :key="g.key" :label="g.label">
              <option v-for="d in g.items" :key="d.tag" :value="d.tag">{{ d.labelPl }}</option>
            </optgroup>
          </select>
        </label>

        <div>
          <span class="mb-1 block text-xs font-medium text-slate-500">Data</span>
          <PersonGedcomDateInput v-model="fDate" />
        </div>

        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-500">Miejsce</span>
          <input v-model="fPlace" type="text" placeholder="np. Warszawa, Mazowieckie, Polska" class="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
        </label>

        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-500">Opis / wartość</span>
          <input v-model="fValue" type="text" placeholder="np. zawód, szkoła, szczegóły" class="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
        </label>

        <!-- uczestnicy (chrzestni/świadkowie) -->
        <div v-if="supportsParticipants" class="space-y-2 rounded-lg border border-slate-200 p-3">
          <span class="block text-xs font-medium text-slate-500">Uczestnicy (chrzestni / świadkowie)</span>
          <div v-for="(p, i) in fParticipants" :key="i" class="space-y-1.5 rounded-md bg-slate-50 p-2">
            <div class="flex items-center gap-2">
              <select v-model="p.role" class="rounded-lg border border-slate-200 px-2 py-1 text-xs">
                <option v-for="r in ROLES" :key="r.value" :value="r.value">{{ r.label }}</option>
              </select>
              <input v-model="p.name" type="text" placeholder="Imię i nazwisko" class="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs" />
              <button class="rounded px-1.5 text-slate-400 hover:bg-slate-200" @click="removeParticipant(i)">✕</button>
            </div>
            <PersonPicker
              :tree-id="person.treeId"
              placeholder="…lub wskaż osobę z drzewa"
              @select="(sel) => { p.individualId = sel.id; p.name = sel.name; }"
            />
            <p v-if="p.individualId" class="text-[11px] text-emerald-600">✓ powiązano z osobą w drzewie</p>
          </div>
          <button class="text-xs font-medium text-sky-600 hover:underline" @click="addParticipant">+ dodaj uczestnika</button>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <button class="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100" @click="showForm = false">Anuluj</button>
          <button :disabled="saving" class="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50" @click="save">
            {{ saving ? 'Zapisywanie…' : 'Zapisz' }}
          </button>
        </div>
      </template>
    </CommonModal>
  </div>
</template>
