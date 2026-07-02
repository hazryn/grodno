<script setup lang="ts">
import type { Sex } from '@rodno/shared';

const props = withDefaults(
  defineProps<{
    photoUrl?: string | null;
    name?: string;
    sex?: Sex;
    online?: boolean;
    showPresence?: boolean;
    size?: 'sm' | 'md' | 'lg';
  }>(),
  { size: 'md', showPresence: false, online: false },
);

const dim = computed(
  () =>
    ({
      sm: 'h-8 w-8 text-[11px]',
      md: 'h-10 w-10 text-sm',
      lg: 'h-12 w-12 text-base',
    })[props.size],
);
const colors = computed(() =>
  props.sex === 'M'
    ? 'bg-sky-200 text-sky-800'
    : props.sex === 'F'
      ? 'bg-pink-200 text-pink-800'
      : 'bg-slate-200 text-slate-700',
);
const initials = computed(
  () =>
    (props.name ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?',
);
</script>

<template>
  <span class="relative inline-flex shrink-0">
    <span
      class="inline-flex items-center justify-center overflow-hidden rounded-full font-semibold"
      :class="[dim, colors]"
    >
      <img
        v-if="photoUrl"
        :src="photoUrl"
        :alt="name"
        class="h-full w-full object-cover"
        loading="lazy"
      />
      <span v-else>{{ initials }}</span>
    </span>
    <span
      v-if="showPresence && online"
      class="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500"
    />
  </span>
</template>
