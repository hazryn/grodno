<script setup lang="ts">
defineProps<{ individualId: string | null }>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'recenter', id: string): void;
}>();
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet-fade">
      <div
        v-if="individualId"
        class="fixed inset-0 z-50 bg-slate-900/30"
        @click.self="emit('close')"
      >
        <Transition name="sheet-slide" appear>
          <div
            v-if="individualId"
            class="absolute right-0 top-0 flex h-full w-full max-w-md flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl"
          >
            <PersonDetail
              :individual-id="individualId"
              @close="emit('close')"
              @recenter="(id) => emit('recenter', id)"
            />
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet-fade-enter-active,
.sheet-fade-leave-active {
  transition: opacity 0.2s ease;
}
.sheet-fade-enter-from,
.sheet-fade-leave-to {
  opacity: 0;
}
.sheet-slide-enter-active,
.sheet-slide-leave-active {
  transition: transform 0.25s ease;
}
.sheet-slide-enter-from,
.sheet-slide-leave-to {
  transform: translateX(100%);
}
</style>
