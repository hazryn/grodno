<script setup lang="ts">
const props = defineProps<{
  open: { id: string; name: string; x: number; y: number; hasFather: boolean; hasMother: boolean } | null;
}>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'pick', label: string): void;
}>();

const { t } = useI18n();

type Opt = { label: string; tone: string; slot?: 'father' | 'mother' };
const options = computed<Opt[]>(() => [
  { label: t('addRelative.father'), tone: 'bg-sky-100 text-sky-600', slot: 'father' },
  { label: t('addRelative.mother'), tone: 'bg-pink-100 text-pink-600', slot: 'mother' },
  { label: t('addRelative.brother'), tone: 'bg-sky-100 text-sky-600' },
  { label: t('addRelative.sister'), tone: 'bg-pink-100 text-pink-600' },
  { label: t('addRelative.partner'), tone: 'bg-slate-100 text-slate-500' },
  { label: t('addRelative.son'), tone: 'bg-sky-100 text-sky-600' },
  { label: t('addRelative.daughter'), tone: 'bg-pink-100 text-pink-600' },
]);

// Wyszarz „Dodaj ojca/matkę", gdy osoba już ma ojca/matkę.
const isDisabled = (o: Opt): boolean =>
  (o.slot === 'father' && !!props.open?.hasFather) ||
  (o.slot === 'mother' && !!props.open?.hasMother);

const W = 256;
const H = 360;
const popStyle = computed(() => {
  if (!props.open) return {};
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const left = Math.min(props.open.x, vw - W - 12);
  const top = Math.min(props.open.y + 8, vh - H - 12);
  return { left: `${Math.max(12, left)}px`, top: `${Math.max(12, top)}px`, width: `${W}px` };
});
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[60]" @click="emit('close')">
      <Transition name="pop" appear>
        <div
          class="absolute rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl"
          :style="popStyle"
          @click.stop
        >
          <div class="flex items-center justify-between px-2 py-1">
            <span class="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {{ $t('addRelative.title') }}
            </span>
            <button class="rounded p-0.5 text-slate-400 hover:bg-slate-100" @click="emit('close')">✕</button>
          </div>
          <p class="truncate px-2 pb-1.5 text-xs text-slate-500">{{ $t('addRelative.to', { name: open?.name }) }}</p>
          <button
            v-for="(o, i) in options"
            :key="o.label"
            :disabled="isDisabled(o)"
            class="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition"
            :class="[
              { 'mt-1 border-t border-slate-100 pt-2': i === 5 },
              isDisabled(o) ? 'cursor-not-allowed opacity-40' : 'hover:bg-slate-50',
            ]"
            @click="!isDisabled(o) && emit('pick', o.label)"
          >
            <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" :class="o.tone">
              <svg viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4">
                <path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z" />
              </svg>
            </span>
            <span class="text-sm text-slate-700">{{ o.label }}</span>
            <span v-if="isDisabled(o)" class="ml-auto text-[10px] text-slate-400">{{ $t('addRelative.exists') }}</span>
          </button>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>

<style scoped>
.pop-enter-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.pop-enter-from {
  opacity: 0;
  transform: scale(0.96) translateY(-4px);
}
</style>
