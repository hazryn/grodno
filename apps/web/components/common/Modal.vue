<script setup lang="ts">
/** Reużywalny modal aplikacji (Teleport + Transition). Tag: <CommonModal>. */
withDefaults(
  defineProps<{
    open: boolean;
    title?: string;
    /** Szerokość maksymalna (klasa Tailwind), np. 'max-w-lg'. */
    maxWidth?: string;
    /** Czy klik w tło zamyka modal. */
    closeOnBackdrop?: boolean;
  }>(),
  { title: '', maxWidth: 'max-w-lg', closeOnBackdrop: true },
);
const emit = defineEmits<{ (e: 'close'): void }>();
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4"
        @click.self="closeOnBackdrop && emit('close')"
      >
        <div
          class="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          :class="maxWidth"
        >
          <div
            v-if="title || $slots.header"
            class="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5"
          >
            <slot name="header">
              <h2 class="text-base font-semibold text-slate-800">{{ title }}</h2>
            </slot>
            <button
              class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              :aria-label="$t('common.close')"
              @click="emit('close')"
            >
              ✕
            </button>
          </div>

          <div class="flex-1 overflow-y-auto">
            <slot />
          </div>

          <div v-if="$slots.footer" class="border-t border-slate-100 bg-slate-50 px-5 py-3">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
