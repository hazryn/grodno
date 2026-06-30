<script setup lang="ts">
/** Host toastów aplikacji. Montowany raz w app.vue. Tag: <CommonToaster>. */
const { toasts, dismiss } = useToast();

const kindClass = (k: string) =>
  k === 'success'
    ? 'bg-emerald-600'
    : k === 'error'
      ? 'bg-rose-600'
      : 'bg-slate-800';
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed bottom-6 left-1/2 z-[80] flex -translate-x-1/2 flex-col items-center gap-2">
      <TransitionGroup
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 translate-y-2"
        leave-active-class="transition duration-100 ease-in"
        leave-to-class="opacity-0"
      >
        <div
          v-for="t in toasts"
          :key="t.id"
          class="pointer-events-auto cursor-pointer rounded-lg px-4 py-2.5 text-sm text-white shadow-lg"
          :class="kindClass(t.kind)"
          @click="dismiss(t.id)"
        >
          {{ t.message }}
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
