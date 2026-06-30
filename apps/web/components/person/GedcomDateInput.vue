<script setup lang="ts">
import type { GedcomDateValue, GedcomDateKind, SimpleDate } from '@rodno/shared';

/** Edytor daty genealogicznej (dzień/miesiąc/rok + modyfikator). v-model: GedcomDateValue | null. */
const props = defineProps<{ modelValue: GedcomDateValue | null }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: GedcomDateValue | null): void }>();

const KINDS: Array<{ value: GedcomDateKind; label: string }> = [
  { value: 'exact', label: 'dokładna' },
  { value: 'about', label: 'około (ok.)' },
  { value: 'before', label: 'przed' },
  { value: 'after', label: 'po' },
  { value: 'between', label: 'między…a' },
  { value: 'period', label: 'od…do' },
];

const GED_MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTHS_PL = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

const kind = ref<GedcomDateKind>(props.modelValue?.kind ?? 'exact');
const d1 = reactive<SimpleDate>({ ...(props.modelValue?.date ?? {}) });
const d2 = reactive<SimpleDate>({ ...(props.modelValue?.end ?? {}) });

watch(
  () => props.modelValue,
  (v) => {
    kind.value = v?.kind ?? 'exact';
    Object.assign(d1, { day: undefined, month: undefined, year: undefined, ...(v?.date ?? {}) });
    Object.assign(d2, { day: undefined, month: undefined, year: undefined, ...(v?.end ?? {}) });
  },
);

const hasRange = computed(() => kind.value === 'between' || kind.value === 'period');

function clean(d: SimpleDate): SimpleDate | undefined {
  const out: SimpleDate = {};
  if (d.day) out.day = Number(d.day);
  if (d.month) out.month = Number(d.month);
  if (d.year) out.year = Number(d.year);
  return out.day || out.month || out.year ? out : undefined;
}

function rawOf(d: SimpleDate | undefined): string {
  if (!d) return '';
  const parts: string[] = [];
  if (d.day) parts.push(String(d.day));
  if (d.month) parts.push(GED_MONTHS[d.month - 1] ?? String(d.month));
  if (d.year) parts.push(String(d.year));
  return parts.join(' ');
}

function emitValue() {
  const a = clean(d1);
  const b = clean(d2);
  if (!a && !b) {
    emit('update:modelValue', null);
    return;
  }
  let raw = '';
  switch (kind.value) {
    case 'about': raw = `ABT ${rawOf(a)}`; break;
    case 'before': raw = `BEF ${rawOf(a)}`; break;
    case 'after': raw = `AFT ${rawOf(a)}`; break;
    case 'between': raw = `BET ${rawOf(a)} AND ${rawOf(b)}`; break;
    case 'period': raw = `FROM ${rawOf(a)} TO ${rawOf(b)}`; break;
    default: raw = rawOf(a);
  }
  const value: GedcomDateValue = { raw: raw.trim(), kind: kind.value };
  if (a) value.date = a;
  if (b) value.end = b;
  emit('update:modelValue', value);
}

watch([kind, d1, d2], emitValue, { deep: true });
</script>

<template>
  <div class="space-y-2">
    <select
      v-model="kind"
      class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
    >
      <option v-for="k in KINDS" :key="k.value" :value="k.value">{{ k.label }}</option>
    </select>

    <div class="flex items-center gap-1.5">
      <input
        v-model.number="d1.day"
        type="number" min="1" max="31" placeholder="dz."
        class="w-14 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
      />
      <select v-model.number="d1.month" class="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
        <option :value="undefined">mies.</option>
        <option v-for="(m, i) in MONTHS_PL" :key="i" :value="i + 1">{{ m }}</option>
      </select>
      <input
        v-model.number="d1.year"
        type="number" placeholder="rok"
        class="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
      />
    </div>

    <div v-if="hasRange" class="flex items-center gap-1.5">
      <span class="w-8 text-xs text-slate-400">{{ kind === 'between' ? 'a' : 'do' }}</span>
      <input
        v-model.number="d2.day"
        type="number" min="1" max="31" placeholder="dz."
        class="w-14 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
      />
      <select v-model.number="d2.month" class="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
        <option :value="undefined">mies.</option>
        <option v-for="(m, i) in MONTHS_PL" :key="i" :value="i + 1">{{ m }}</option>
      </select>
      <input
        v-model.number="d2.year"
        type="number" placeholder="rok"
        class="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
      />
    </div>
  </div>
</template>
