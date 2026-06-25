<script setup lang="ts">
defineProps<{ individualId: string | null }>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'recenter', id: string): void;
}>();
</script>

<template>
  <Teleport to="body">
    <div
      v-if="individualId"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      @click.self="emit('close')"
    >
      <div class="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <PersonDetail
          :individual-id="individualId"
          @close="emit('close')"
          @recenter="(id) => emit('recenter', id)"
        />
      </div>
    </div>
  </Teleport>
</template>
