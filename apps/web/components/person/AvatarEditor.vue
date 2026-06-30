<script setup lang="ts">
import { Cropper, CircleStencil } from 'vue-advanced-cropper';
import { markRaw } from 'vue';
import type { IndividualDto } from '@rodno/shared';

// markRaw — komponent stencila nie ma być reaktywny (Vue ostrzega inaczej).
const circleStencil = markRaw(CircleStencil);

/** Crop + upload avatara. Źródło: plik z dysku albo zdjęcie z galerii (prop `src`). Tag: <PersonAvatarEditor>. */
const props = defineProps<{ person: IndividualDto; src?: string | null }>();
const emit = defineEmits<{ (e: 'saved', person: IndividualDto): void; (e: 'cancel'): void }>();

const api = useApi();
const { success, error } = useToast();

const image = ref<string | null>(props.src ?? null);
// Cropper nie eksportuje typu instancji z getResult() — luźny ref.
const cropperRef = ref<any>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const dragging = ref(false);
const saving = ref(false);
let objectUrl: string | null = null;

function setFile(file: File | null | undefined) {
  if (!file || !file.type.startsWith('image/')) return;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  image.value = objectUrl;
}
function onFile(e: Event) {
  setFile((e.target as HTMLInputElement).files?.[0]);
}
function onDrop(e: DragEvent) {
  dragging.value = false;
  setFile(e.dataTransfer?.files?.[0]);
}

function blobFromCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.9),
  );
}

async function confirm() {
  const result = cropperRef.value?.getResult?.();
  const canvas = result?.canvas as HTMLCanvasElement | undefined;
  if (!canvas) return;
  saving.value = true;
  try {
    const blob = await blobFromCanvas(canvas);
    const updated = await api.uploadAvatar(props.person.id, blob, 'avatar.jpg');
    success('Avatar zaktualizowany.');
    emit('saved', updated);
  } catch {
    error('Nie udało się zapisać avatara.');
  } finally {
    saving.value = false;
  }
}

onBeforeUnmount(() => {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
});
</script>

<template>
  <div class="space-y-3">
    <!-- ukryty input — otwierany klikiem w dropzone -->
    <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFile" />

    <!-- cropper, gdy zdjęcie wybrane -->
    <div v-if="image" class="overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
      <ClientOnly>
        <Cropper
          ref="cropperRef"
          class="h-80"
          :src="image"
          cross-origin="anonymous"
          :stencil-component="circleStencil"
          :stencil-props="{ aspectRatio: 1 }"
        />
      </ClientOnly>
    </div>

    <!-- dropzone, gdy brak zdjęcia -->
    <div
      v-else
      class="flex h-56 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 text-center transition"
      :class="dragging ? 'border-sky-400 bg-sky-50 text-sky-600' : 'border-slate-300 text-slate-400 hover:border-sky-300 hover:bg-slate-50'"
      role="button"
      tabindex="0"
      @click="fileInput?.click()"
      @keydown.enter.prevent="fileInput?.click()"
      @keydown.space.prevent="fileInput?.click()"
      @dragover.prevent="dragging = true"
      @dragenter.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="h-9 w-9">
        <path d="M12 16V4m0 0L8 8m4-4 4 4" />
        <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      </svg>
      <p class="text-sm font-medium">Przeciągnij zdjęcie tutaj</p>
      <p class="text-xs">lub kliknij, aby wybrać z dysku</p>
    </div>

    <p v-if="!image" class="text-xs text-slate-400">Możesz też użyć „Ustaw jako avatar" przy zdjęciu w galerii.</p>

    <div class="flex justify-end gap-2">
      <button class="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100" @click="emit('cancel')">Anuluj</button>
      <button
        :disabled="!image || saving"
        class="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        @click="confirm"
      >
        {{ saving ? 'Zapisywanie…' : 'Zapisz avatar' }}
      </button>
    </div>
  </div>
</template>
