<script setup lang="ts">
import VueEasyLightbox from 'vue-easy-lightbox';
import type { GedcomDateValue, IndividualDto, MarriageDto } from '@rodno/shared';

/** Panel małżeństw/związków (ekran „Dane", jak MyHeritage): małżonek, data, miejsce, zdjęcie. Tag: <PersonMarriages>. */
const props = defineProps<{ person: IndividualDto }>();
const emit = defineEmits<{ (e: 'changed', person: IndividualDto): void }>();

const api = useApi();
const { success, error } = useToast();
const { ask } = useConfirm();

interface Row {
  partnershipId: string;
  spouseId: string | null;
  spouseName: string | null;
  type: string;
  date: GedcomDateValue | null;
  placeName: string;
  photoUrl: string | null;
  changingSpouse: boolean;
  saving: boolean;
}

function toRow(m: MarriageDto): Row {
  return {
    partnershipId: m.partnershipId,
    spouseId: m.spouseId,
    spouseName: m.spouseName,
    type: m.type,
    date: m.date,
    placeName: m.placeName ?? '',
    photoUrl: m.photoUrl,
    changingSpouse: false,
    saving: false,
  };
}

const rows = ref<Row[]>(props.person.marriages.map(toRow));
watch(() => props.person.marriages, (v) => (rows.value = v.map(toRow)));

const adding = ref(false);
const lbUrl = ref<string | null>(null);

async function save(r: Row) {
  r.saving = true;
  try {
    const updated = await api.patchMarriage(props.person.id, r.partnershipId, {
      type: r.type,
      date: r.date,
      placeName: r.placeName.trim() || null,
    });
    success('Zapisano małżeństwo.');
    emit('changed', updated);
  } catch {
    error('Nie udało się zapisać.');
  } finally {
    r.saving = false;
  }
}

async function changeSpouse(r: Row, spouseId: string) {
  try {
    const updated = await api.patchMarriage(props.person.id, r.partnershipId, { spouseId });
    success('Zmieniono małżonka.');
    emit('changed', updated);
  } catch {
    error('Nie udało się zmienić małżonka.');
  }
}

async function addMarriage(spouseId: string) {
  try {
    const updated = await api.addMarriage(props.person.id, { spouseId });
    success('Dodano małżeństwo.');
    adding.value = false;
    emit('changed', updated);
  } catch {
    error('Nie udało się dodać.');
  }
}

async function remove(r: Row) {
  const ok = await ask({
    title: 'Usunąć małżeństwo?',
    message: r.spouseName ? `Związek z: ${r.spouseName}` : undefined,
    confirmLabel: 'Usuń',
    danger: true,
  });
  if (!ok) return;
  try {
    const updated = await api.deleteMarriage(props.person.id, r.partnershipId);
    success('Usunięto małżeństwo.');
    emit('changed', updated);
  } catch {
    error('Nie udało się usunąć.');
  }
}

async function onPhoto(r: Row, e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const updated = await api.uploadMarriagePhoto(props.person.id, r.partnershipId, file, file.name);
    success('Zapisano zdjęcie ślubu.');
    emit('changed', updated);
  } catch {
    error('Nie udało się wgrać zdjęcia.');
  } finally {
    (e.target as HTMLInputElement).value = '';
  }
}
</script>

<template>
  <div class="space-y-3">
    <span class="block text-xs font-semibold uppercase tracking-wide text-slate-400">Małżeństwa i związki</span>

    <div v-for="r in rows" :key="r.partnershipId" class="space-y-3 rounded-xl border border-slate-200 p-3">
      <div class="flex items-start gap-3">
        <!-- zdjęcie ślubu -->
        <div class="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
          <img v-if="r.photoUrl" :src="r.photoUrl" class="h-full w-full cursor-zoom-in object-cover" @click="lbUrl = r.photoUrl" />
          <label class="flex h-full w-full cursor-pointer items-center justify-center text-center text-[10px] text-slate-400 hover:bg-slate-50">
            <input type="file" accept="image/*" class="hidden" @change="(e) => onPhoto(r, e)" />
            <span v-if="!r.photoUrl">+ zdjęcie</span>
          </label>
        </div>
        <div class="min-w-0 flex-1">
          <!-- małżonek -->
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium text-slate-700">{{ r.spouseName || 'brak małżonka' }}</span>
            <button class="text-xs text-sky-600 hover:underline" @click="r.changingSpouse = !r.changingSpouse">zmień</button>
          </div>
          <PersonPicker
            v-if="r.changingSpouse"
            :tree-id="person.treeId"
            placeholder="Wskaż małżonka z drzewa…"
            class="mt-1"
            @select="(p) => { changeSpouse(r, p.id); r.changingSpouse = false; }"
          />
          <!-- typ -->
          <select v-model="r.type" class="mt-1.5 rounded-lg border border-slate-200 px-2 py-1 text-xs">
            <option value="married">Ślub</option>
            <option value="partner">Związek nieformalny</option>
          </select>
        </div>
        <button class="rounded px-1.5 py-0.5 text-xs text-rose-500 hover:bg-rose-50" title="Usuń" @click="remove(r)">✕</button>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <span class="mb-1 block text-xs font-medium text-slate-500">Data ślubu</span>
          <PersonGedcomDateInput v-model="r.date" />
        </div>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-500">Miejsce</span>
          <input v-model="r.placeName" type="text" placeholder="np. Warszawa" class="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
        </label>
      </div>

      <div class="flex justify-end">
        <button :disabled="r.saving" class="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-50" @click="save(r)">
          {{ r.saving ? 'Zapisywanie…' : 'Zapisz' }}
        </button>
      </div>
    </div>

    <!-- dodaj małżeństwo -->
    <div v-if="adding" class="rounded-xl border border-dashed border-slate-300 p-3">
      <span class="mb-1 block text-xs font-medium text-slate-500">Małżonek (z drzewa)</span>
      <PersonPicker :tree-id="person.treeId" placeholder="Szukaj osoby…" @select="(p) => addMarriage(p.id)" />
      <button class="mt-2 text-xs text-slate-500 hover:underline" @click="adding = false">anuluj</button>
    </div>
    <button v-else class="text-xs font-medium text-sky-600 hover:underline" @click="adding = true">+ dodaj małżeństwo</button>

    <ClientOnly>
      <VueEasyLightbox :visible="!!lbUrl" :imgs="lbUrl ? [lbUrl] : []" @hide="lbUrl = null" />
    </ClientOnly>
  </div>
</template>
