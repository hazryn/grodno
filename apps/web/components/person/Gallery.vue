<script setup lang="ts">
import VueEasyLightbox from 'vue-easy-lightbox';
import { type GedcomDateValue, type IndividualDto, type MediaDto } from '@rodno/shared';

/**
 * Galeria osoby. Tryby: edycja (sort/upload/opis/oznaczanie/avatar/usuwanie),
 * `readonly` (tylko podgląd + lightbox), `preview` (read-only, max 2 rzędy + „Otwórz galerię").
 * Tag: <PersonGallery>.
 */
const props = withDefaults(
  defineProps<{ person: IndividualDto; readonly?: boolean; preview?: boolean }>(),
  { readonly: false, preview: false },
);
const emit = defineEmits<{ (e: 'avatar-changed', person: IndividualDto): void }>();

const api = useApi();
const { success, error } = useToast();
const { ask } = useConfirm();
const { t } = useI18n();
const { formatDate } = useDomainLabels();

const items = ref<MediaDto[]>([]);
const loading = ref(true);
const uploading = ref(false);

// tryby tylko-do-odczytu
const isReadonly = computed(() => props.readonly || props.preview);
const PREVIEW_MAX = 6; // 2 rzędy × 3
const visibleItems = computed(() => (props.preview ? items.value.slice(0, PREVIEW_MAX) : items.value));
const extraCount = computed(() => (props.preview ? Math.max(0, items.value.length - PREVIEW_MAX) : 0));
const showFull = ref(false); // modal pełnej galerii (z podglądu)

// lightbox
const lbVisible = ref(false);
const lbIndex = ref(0);
const lbImgs = computed(() => items.value.map((m) => m.url || ''));

// modale
const editing = ref<MediaDto | null>(null);
const editCaption = ref('');
const editDate = ref<GedcomDateValue | null>(null);
const tagging = ref<MediaDto | null>(null);
const avatarFrom = ref<MediaDto | null>(null);

async function load() {
  loading.value = true;
  try {
    items.value = await api.gallery(props.person.id);
  } finally {
    loading.value = false;
  }
}
onMounted(load);

async function onUpload(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files ?? []);
  if (!files.length) return;
  uploading.value = true;
  try {
    const created = await api.uploadMedia(props.person.id, files);
    items.value = [...items.value, ...created];
    success(t('gallery.successUpload', created.length, { n: created.length }));
  } catch {
    error(t('gallery.errorUpload'));
  } finally {
    uploading.value = false;
    (e.target as HTMLInputElement).value = '';
  }
}

// drag-sort (natywny HTML5 DnD — bez zależności)
const dragIdx = ref<number | null>(null);
function onDragStart(i: number) {
  dragIdx.value = i;
}
function onDragOver(i: number) {
  if (dragIdx.value === null || dragIdx.value === i) return;
  const arr = [...items.value];
  const [moved] = arr.splice(dragIdx.value, 1);
  arr.splice(i, 0, moved);
  items.value = arr;
  dragIdx.value = i;
}
async function onDragEnd() {
  if (dragIdx.value === null) return;
  dragIdx.value = null;
  try {
    await api.reorderMedia(props.person.id, items.value.map((m) => m.id));
  } catch {
    error(t('gallery.errorReorder'));
  }
}

function openLightbox(i: number) {
  lbIndex.value = i;
  lbVisible.value = true;
}

function openEdit(m: MediaDto) {
  editing.value = m;
  editCaption.value = m.caption ?? '';
  editDate.value = m.takenDate;
}
async function saveEdit() {
  if (!editing.value) return;
  try {
    const updated = await api.patchMedia(editing.value.id, {
      caption: editCaption.value.trim() || null,
      takenDate: editDate.value,
    });
    items.value = items.value.map((m) => (m.id === updated.id ? updated : m));
    success(t('gallery.successCaption'));
    editing.value = null;
  } catch {
    error(t('gallery.errorCaption'));
  }
}

function onTagged(updated: MediaDto) {
  items.value = items.value.map((m) => (m.id === updated.id ? updated : m));
  tagging.value = null;
}

function onAvatarSaved(person: IndividualDto) {
  avatarFrom.value = null;
  emit('avatar-changed', person);
  success(t('gallery.successAvatar'));
}

async function removePhoto(m: MediaDto) {
  const ok = await ask({ title: t('gallery.confirmTitle'), message: t('gallery.confirmMessage'), confirmLabel: t('gallery.confirmDelete'), danger: true });
  if (!ok) return;
  try {
    await api.deleteMedia(m.id);
    items.value = items.value.filter((x) => x.id !== m.id);
    success(t('gallery.successDelete'));
  } catch {
    error(t('gallery.errorDelete'));
  }
}
</script>

<template>
  <!-- w trybie podglądu nie zajmujemy miejsca, gdy brak zdjęć -->
  <div v-if="!preview || items.length" class="space-y-3">
    <!-- nagłówek: w pełnej galerii (readonly) niepotrzebny — tytuł daje modal -->
    <div v-if="!readonly" class="flex items-center justify-between">
      <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {{ $t('gallery.title') }}<span v-if="preview && items.length" class="ml-1 text-slate-300">({{ items.length }})</span>
      </span>
      <!-- edycja: upload -->
      <label v-if="!isReadonly" class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700">
        <input type="file" accept="image/*" multiple class="hidden" @change="onUpload" />
        {{ uploading ? $t('gallery.uploading') : $t('gallery.upload') }}
      </label>
      <!-- podgląd: otwórz pełną galerię -->
      <button
        v-else-if="preview && items.length"
        class="text-xs font-medium text-sky-600 hover:underline"
        @click="showFull = true"
      >
        {{ $t('gallery.openFull') }}
      </button>
    </div>

    <p v-if="loading && !isReadonly" class="text-sm text-slate-400">{{ $t('gallery.loading') }}</p>
    <p v-else-if="!items.length && !isReadonly" class="text-sm text-slate-400">{{ $t('gallery.empty') }}</p>

    <div v-if="visibleItems.length" class="grid grid-cols-3 gap-2">
      <div
        v-for="(m, index) in visibleItems"
        :key="m.id"
        class="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
        :class="[{ 'opacity-40': dragIdx === index }, isReadonly ? '' : 'cursor-move']"
        :draggable="!isReadonly"
        @dragstart="!isReadonly && onDragStart(index)"
        @dragover.prevent="!isReadonly && onDragOver(index)"
        @dragend="!isReadonly && onDragEnd()"
        @drop.prevent="!isReadonly && onDragEnd()"
      >
        <img
          :src="m.url || ''"
          :alt="m.caption || ''"
          class="h-full w-full cursor-zoom-in object-cover"
          draggable="false"
          @click="openLightbox(index)"
        />
        <!-- nakładka „+N więcej" na ostatnim kafelku podglądu -->
        <button
          v-if="preview && extraCount && index === visibleItems.length - 1"
          class="absolute inset-0 flex items-center justify-center bg-black/55 text-lg font-semibold text-white"
          @click.stop="showFull = true"
        >
          +{{ extraCount }}
        </button>
        <!-- liczba oznaczeń -->
        <span v-if="m.tags.length" class="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
          ◰ {{ m.tags.length }}
        </span>
        <!-- data -->
        <span v-if="m.takenDate" class="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
          {{ formatDate(m.takenDate) }}
        </span>
        <!-- akcje (tylko edycja) -->
        <div v-if="!isReadonly" class="absolute inset-x-0 top-0 flex justify-end gap-1 bg-gradient-to-b from-black/50 to-transparent p-1 opacity-0 transition group-hover:opacity-100">
          <button class="rounded bg-white/90 px-1.5 py-0.5 text-[11px] hover:bg-white" :title="$t('gallery.btnCaption')" @click="openEdit(m)">✎</button>
          <button class="rounded bg-white/90 px-1.5 py-0.5 text-[11px] hover:bg-white" :title="$t('gallery.btnTags')" @click="tagging = m">◰</button>
          <button class="rounded bg-white/90 px-1.5 py-0.5 text-[11px] hover:bg-white" :title="$t('gallery.btnSetAvatar')" @click="avatarFrom = m">☺</button>
          <button class="rounded bg-rose-500/90 px-1.5 py-0.5 text-[11px] text-white hover:bg-rose-600" :title="$t('common.delete')" @click="removePhoto(m)">✕</button>
        </div>
      </div>
    </div>

    <ClientOnly>
      <VueEasyLightbox :visible="lbVisible" :imgs="lbImgs" :index="lbIndex" @hide="lbVisible = false" />
    </ClientOnly>

    <!-- pełna galeria w osobnym oknie (z podglądu) -->
    <CommonModal v-if="preview" :open="showFull" :title="$t('gallery.title')" max-width="max-w-3xl" @close="showFull = false">
      <div class="p-5">
        <PersonGallery :person="person" readonly />
      </div>
    </CommonModal>

    <!-- edycja opisu + daty -->
    <CommonModal :open="!!editing" :title="$t('gallery.editTitle')" max-width="max-w-sm" :close-on-backdrop="false" @close="editing = null">
      <div class="space-y-3 p-5">
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-500">{{ $t('gallery.captionLabel') }}</span>
          <textarea v-model="editCaption" rows="2" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </label>
        <div>
          <span class="mb-1 block text-xs font-medium text-slate-500">{{ $t('gallery.dateLabel') }}</span>
          <PersonGedcomDateInput v-model="editDate" />
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <button class="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100" @click="editing = null">{{ $t('common.cancel') }}</button>
          <button class="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700" @click="saveEdit">{{ $t('common.save') }}</button>
        </div>
      </template>
    </CommonModal>

    <!-- oznaczanie osób -->
    <CommonModal :open="!!tagging" :title="$t('gallery.tagModalTitle')" max-width="max-w-2xl" :close-on-backdrop="false" @close="tagging = null">
      <div class="p-5">
        <PersonPhotoTagger v-if="tagging" :media="tagging" :tree-id="person.treeId" @saved="onTagged" @close="tagging = null" />
      </div>
    </CommonModal>

    <!-- avatar ze zdjęcia galerii -->
    <CommonModal :open="!!avatarFrom" :title="$t('gallery.avatarModalTitle')" max-width="max-w-lg" :close-on-backdrop="false" @close="avatarFrom = null">
      <div class="p-5">
        <PersonAvatarEditor v-if="avatarFrom" :person="person" :src="avatarFrom.url" @saved="onAvatarSaved" @cancel="avatarFrom = null" />
      </div>
    </CommonModal>
  </div>
</template>
