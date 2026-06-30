<script setup lang="ts">
import type { MediaDto, MediaTagDto } from '@rodno/shared';

/** Oznaczanie osób na zdjęciu kwadracikami (współrzędne 0..1). Tag: <PersonPhotoTagger>. */
const props = defineProps<{ media: MediaDto; treeId: string }>();
const emit = defineEmits<{ (e: 'saved', media: MediaDto): void; (e: 'close'): void }>();

const api = useApi();
const { success, error } = useToast();
const { t } = useI18n();

type DraftTag = Partial<MediaTagDto> & { x: number; y: number; w: number; h: number };
const tags = ref<DraftTag[]>(props.media.tags.map((t) => ({ ...t })));
const surface = ref<HTMLElement | null>(null);
const saving = ref(false);

// rysowanie nowego kwadracika
const drawing = ref(false);
const draft = ref<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
const activeIndex = ref<number | null>(null);

function rel(e: PointerEvent): { x: number; y: number } {
  const r = surface.value!.getBoundingClientRect();
  return {
    x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
    y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
  };
}

function onDown(e: PointerEvent) {
  if ((e.target as HTMLElement).closest('[data-tag]')) return; // klik w istniejący tag
  const p = rel(e);
  drawing.value = true;
  draft.value = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
  surface.value?.setPointerCapture(e.pointerId);
}
function onMove(e: PointerEvent) {
  if (!drawing.value || !draft.value) return;
  const p = rel(e);
  draft.value.x1 = p.x;
  draft.value.y1 = p.y;
}
function onUp() {
  if (!drawing.value || !draft.value) return;
  drawing.value = false;
  const d = draft.value;
  const x = Math.min(d.x0, d.x1);
  const y = Math.min(d.y0, d.y1);
  const w = Math.abs(d.x1 - d.x0);
  const h = Math.abs(d.y1 - d.y0);
  draft.value = null;
  if (w < 0.03 || h < 0.03) return; // za mały → ignoruj
  tags.value = [...tags.value, { x, y, w, h, individualId: null, name: null }];
  activeIndex.value = tags.value.length - 1;
}

function assign(i: number, person: { id: string; name: string }) {
  tags.value[i] = { ...tags.value[i], individualId: person.id, name: person.name };
  activeIndex.value = null;
}
function setName(i: number, name: string) {
  tags.value[i] = { ...tags.value[i], name, individualId: null };
}
function remove(i: number) {
  tags.value = tags.value.filter((_, idx) => idx !== i);
  if (activeIndex.value === i) activeIndex.value = null;
}

const boxStyle = (t: DraftTag) => ({
  left: `${t.x * 100}%`,
  top: `${t.y * 100}%`,
  width: `${t.w * 100}%`,
  height: `${t.h * 100}%`,
});
const draftStyle = computed(() => {
  const d = draft.value;
  if (!d) return {};
  return {
    left: `${Math.min(d.x0, d.x1) * 100}%`,
    top: `${Math.min(d.y0, d.y1) * 100}%`,
    width: `${Math.abs(d.x1 - d.x0) * 100}%`,
    height: `${Math.abs(d.y1 - d.y0) * 100}%`,
  };
});

async function save() {
  saving.value = true;
  try {
    const payload = tags.value.map((t) => ({
      individualId: t.individualId ?? null,
      name: t.name ?? null,
      x: t.x,
      y: t.y,
      w: t.w,
      h: t.h,
    }));
    const updated = await api.putMediaTags(props.media.id, payload);
    success(t('tagger.success'));
    emit('saved', updated);
  } catch {
    error(t('tagger.error'));
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="space-y-3">
    <p class="text-xs text-slate-500">{{ $t('tagger.instruction') }}</p>
    <div
      ref="surface"
      class="relative select-none touch-none overflow-hidden rounded-xl bg-slate-900"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
    >
      <img :src="media.url || ''" :alt="media.caption || ''" class="block max-h-[70vh] w-full object-contain" draggable="false" />

      <!-- istniejące oznaczenia -->
      <div
        v-for="(t, i) in tags"
        :key="i"
        data-tag
        class="absolute border-2 border-sky-400 bg-sky-400/10"
        :style="boxStyle(t)"
      >
        <span class="absolute -top-6 left-0 whitespace-nowrap rounded bg-sky-500 px-1.5 py-0.5 text-[11px] text-white">
          {{ t.name || $t('tagger.unnamed') }}
        </span>
        <button
          class="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[11px] text-white"
          @click.stop="remove(i)"
        >✕</button>
      </div>

      <!-- rysowany draft -->
      <div v-if="draft" class="absolute border-2 border-dashed border-amber-400 bg-amber-400/10" :style="draftStyle" />
    </div>

    <!-- przypisanie osoby do aktywnego boxa -->
    <div v-if="activeIndex !== null" class="rounded-lg border border-slate-200 p-3">
      <p class="mb-2 text-xs font-medium text-slate-500">{{ $t('tagger.who') }}</p>
      <PersonPicker :tree-id="treeId" :placeholder="$t('tagger.whoSearch')" @select="(p) => assign(activeIndex!, { id: p.id, name: p.name })" />
      <div class="mt-2 flex items-center gap-2">
        <span class="text-xs text-slate-400">{{ $t('tagger.whoManual') }}</span>
        <input
          type="text"
          class="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm"
          :placeholder="$t('tagger.whoManualPlaceholder')"
          @input="setName(activeIndex!, ($event.target as HTMLInputElement).value)"
        />
        <button class="text-xs text-sky-600 hover:underline" @click="activeIndex = null">{{ $t('tagger.doneTag') }}</button>
      </div>
    </div>

    <div class="flex justify-end gap-2">
      <button class="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100" @click="emit('close')">{{ $t('tagger.close') }}</button>
      <button
        :disabled="saving"
        class="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        @click="save"
      >
        {{ saving ? $t('tagger.saving') : $t('tagger.save') }}
      </button>
    </div>
  </div>
</template>
