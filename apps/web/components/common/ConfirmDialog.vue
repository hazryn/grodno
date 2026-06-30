<script setup lang="ts">
/** Host potwierdzeń (zamiast window.confirm). Montowany raz w app.vue. Tag: <CommonConfirmDialog>. */
const { t } = useI18n();
const { state, settle } = useConfirm();
</script>

<template>
  <CommonModal
    :open="state.open"
    :title="state.title"
    max-width="max-w-sm"
    :close-on-backdrop="true"
    @close="settle(false)"
  >
    <div class="px-5 py-4">
      <p v-if="state.message" class="text-sm leading-relaxed text-slate-600">{{ state.message }}</p>
    </div>
    <template #footer>
      <div class="flex justify-end gap-2">
        <button
          class="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          @click="settle(false)"
        >
          {{ state.cancelLabel || $t('common.cancel') }}
        </button>
        <button
          class="rounded-lg px-3 py-1.5 text-sm font-medium text-white"
          :class="state.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-sky-600 hover:bg-sky-700'"
          @click="settle(true)"
        >
          {{ state.confirmLabel || $t('common.ok') }}
        </button>
      </div>
    </template>
  </CommonModal>
</template>
