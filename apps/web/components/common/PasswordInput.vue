<script setup lang="ts">
defineProps<{
  modelValue: string;
  placeholder?: string;
  autocomplete?: string;
  invalid?: boolean;
}>();
defineEmits<{ (e: 'update:modelValue', value: string): void }>();

const { t } = useI18n();
const show = ref(false);
</script>

<template>
  <div class="relative">
    <input
      :type="show ? 'text' : 'password'"
      :value="modelValue"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :aria-invalid="invalid || undefined"
      class="w-full rounded-lg border px-3 py-2 pr-10 text-sm outline-none focus:ring-2"
      :class="invalid
        ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100'
        : 'border-slate-200 focus:border-amber-400 focus:ring-amber-100'"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <button
      type="button"
      tabindex="-1"
      class="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition hover:text-slate-600"
      :aria-label="show ? t('common.hidePassword') : t('common.showPassword')"
      :title="show ? t('common.hidePassword') : t('common.showPassword')"
      @click="show = !show"
    >
      <!-- oko -->
      <svg v-if="!show" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-5 w-5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
      <!-- oko przekreślone -->
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-5 w-5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65" />
      </svg>
    </button>
  </div>
</template>
