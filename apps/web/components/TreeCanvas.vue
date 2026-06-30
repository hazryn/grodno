<script setup lang="ts">
import type { PersonCard } from '@rodno/shared';
import { CARD_W, CARD_H, type TreeLayout, type PositionedNode } from '../utils/treeGraph';

const props = defineProps<{
  layout: TreeLayout;
  focalId: string;
  canExpandUp: (id: string) => boolean;
  canExpandDown: (id: string) => boolean;
}>();

const emit = defineEmits<{
  (e: 'select', id: string): void;
  (e: 'recenter', id: string): void;
  (e: 'expand-up', id: string): void;
  (e: 'expand-down', id: string): void;
  (e: 'add-parent', payload: { forId: string; slot: 'father' | 'mother' }): void;
  (e: 'add-relative', payload: { id: string; name: string; x: number; y: number }): void;
}>();

const viewport = ref<HTMLElement | null>(null);
const scale = ref(1);
const tx = ref(0);
const ty = ref(0);

let dragging = false;
let lastX = 0;
let lastY = 0;

function onPointerDown(e: PointerEvent) {
  // pan tylko gdy łapiemy tło (nie kafelek/przycisk)
  if ((e.target as HTMLElement).closest('[data-card]')) return;
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}
function onPointerMove(e: PointerEvent) {
  if (!dragging) return;
  tx.value += e.clientX - lastX;
  ty.value += e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
}
function onPointerUp() {
  dragging = false;
}
function onWheel(e: WheelEvent) {
  e.preventDefault();
  const rect = viewport.value!.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
  const newScale = Math.min(2.5, Math.max(0.2, scale.value * factor));
  // zoom względem kursora
  tx.value = mx - ((mx - tx.value) * newScale) / scale.value;
  ty.value = my - ((my - ty.value) * newScale) / scale.value;
  scale.value = newScale;
}

function centerOnFocal() {
  const node = props.layout.nodes.find((n) => n.card.id === props.focalId);
  const vp = viewport.value;
  if (!node || !vp) return;
  scale.value = 1;
  tx.value = vp.clientWidth / 2 - (node.x + CARD_W / 2);
  ty.value = vp.clientHeight / 2 - (node.y + CARD_H / 2);
}

// Pierwsze wyśrodkowanie po zamontowaniu. Kolejne (nawigacja) woła rodzic jawnie
// przez centerOnFocal() PO przebudowie layoutu — inaczej centrowałoby na starej pozycji.
onMounted(() => nextTick(centerOnFocal));
defineExpose({ centerOnFocal });

function elbow(l: { x1: number; y1: number; x2: number; y2: number }): string {
  const { x1, y1, x2, y2 } = l;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  if (Math.abs(dx) < 1) return `M ${x1} ${y1} L ${x2} ${y2}`; // prosto w pionie
  const dir = dx > 0 ? 1 : -1;
  // zaokrąglone rogi (łagodny łuk zamiast kąta 90°)
  const r = Math.min(14, Math.abs(dx) / 2, Math.abs(my - y1), Math.abs(y2 - my));
  const s1 = Math.sign(y1 - my);
  const s2 = Math.sign(y2 - my);
  return [
    `M ${x1} ${y1}`,
    `L ${x1} ${my + r * s1}`,
    `Q ${x1} ${my} ${x1 + dir * r} ${my}`,
    `L ${x2 - dir * r} ${my}`,
    `Q ${x2} ${my} ${x2} ${my + r * s2}`,
    `L ${x2} ${y2}`,
  ].join(' ');
}

function initials(card: PersonCard): string {
  return card.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');
}

function sexClasses(card: PersonCard): string {
  if (card.sex === 'M') return 'border-sky-300 bg-sky-50';
  if (card.sex === 'F') return 'border-pink-300 bg-pink-50';
  return 'border-slate-300 bg-slate-50';
}
function avatarClasses(card: PersonCard): string {
  if (card.sex === 'M') return 'bg-sky-200 text-sky-800';
  if (card.sex === 'F') return 'bg-pink-200 text-pink-800';
  return 'bg-slate-200 text-slate-700';
}
function roleRing(node: PositionedNode): string {
  return node.role === 'focal' ? 'ring-2 ring-amber-400 shadow-lg' : 'shadow-sm';
}
</script>

<template>
  <div
    ref="viewport"
    class="relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_1px_1px,#e2e8f0_1px,transparent_0)] [background-size:22px_22px] touch-none select-none"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointerleave="onPointerUp"
    @wheel="onWheel"
  >
    <div
      class="absolute left-0 top-0 origin-top-left"
      :style="{
        width: layout.width + 'px',
        height: layout.height + 'px',
        transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
      }"
    >
      <!-- linie relacji -->
      <svg
        class="pointer-events-none absolute left-0 top-0"
        :width="layout.width"
        :height="layout.height"
      >
        <path
          v-for="(l, i) in layout.links"
          :key="i"
          :d="l.kind === 'parent' ? elbow(l) : `M ${l.x1} ${l.y1} L ${l.x2} ${l.y2}`"
          fill="none"
          :stroke="l.kind === 'spouse' ? (l.relation === 'partner' ? '#0d9488' : '#e11d48') : l.kind === 'placeholder' ? '#cbd5e1' : '#94a3b8'"
          :stroke-width="l.kind === 'spouse' ? 3 : 1.5"
          :stroke-dasharray="l.kind === 'placeholder' ? '4 4' : undefined"
        />
      </svg>

      <!-- kafelki osób -->
      <div
        v-for="node in layout.nodes"
        :key="node.card.id"
        data-card
        class="group absolute"
        :style="{ left: node.x + 'px', top: node.y + 'px', width: CARD_W + 'px', height: CARD_H + 'px' }"
      >
        <!-- widżet rodziców (jak w MyHeritage) → klik centruje na osobie -->
        <button
          v-if="node.role !== 'focal' && node.card.hasParents"
          class="absolute -top-[19px] right-3 z-10 flex flex-col items-center"
          title="Centruj na tej osobie"
          @click.stop="emit('recenter', node.card.id)"
        >
          <span class="flex items-center">
            <span class="h-[9px] w-4 rounded-full bg-sky-300 ring-1 ring-white transition group-hover:bg-sky-400"></span>
            <span class="h-px w-2 bg-slate-300"></span>
            <span class="h-[9px] w-4 rounded-full bg-pink-300 ring-1 ring-white transition group-hover:bg-pink-400"></span>
          </span>
          <span class="h-[7px] w-px bg-slate-300"></span>
        </button>
        <!-- brak rodziców w drzewie (np. małżonek) → ikonka „otwórz drzewo tej osoby" (centruj) -->
        <button
          v-else-if="node.role !== 'focal'"
          class="absolute -top-[16px] right-3 z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-slate-300 bg-white text-slate-400 shadow-sm transition hover:border-amber-400 hover:text-amber-600"
          title="Otwórz drzewo tej osoby"
          @click.stop="emit('recenter', node.card.id)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="h-2.5 w-2.5">
            <circle cx="12" cy="12" r="3.2" />
            <path d="M12 2.5v3.3M12 18.2v3.3M2.5 12h3.3M18.2 12h3.3" />
          </svg>
        </button>

        <div
          class="group relative flex h-full cursor-pointer items-center gap-2 overflow-hidden rounded-xl border px-2.5 py-1.5 transition hover:shadow-md"
          :class="[sexClasses(node.card), roleRing(node)]"
          @click="emit('select', node.card.id)"
          @dblclick="emit('recenter', node.card.id)"
          :title="node.card.birthplaceFull || ''"
        >
          <!-- wstążka żałobna (osoba zmarła) — narożny baner w lewym górnym rogu -->
          <div
            v-if="node.card.deceased"
            class="pointer-events-none absolute left-0 top-0 z-10 h-9 w-9 overflow-hidden rounded-tl-xl"
            title="Osoba zmarła"
            aria-label="Osoba zmarła"
          >
            <div class="absolute -left-3 top-[7px] w-[52px] -rotate-45 bg-gradient-to-br from-slate-700 to-slate-900 py-[3px] shadow-sm"></div>
          </div>
          <div class="relative shrink-0">
            <div
              class="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full text-base font-semibold"
              :class="avatarClasses(node.card)"
            >
              <img
                v-if="node.card.photoUrl"
                :src="node.card.photoUrl"
                :alt="node.card.name"
                class="h-full w-full object-cover"
                loading="lazy"
              />
              <span v-else>{{ initials(node.card) }}</span>
            </div>
            <!-- badge social (klik → profil, w nowej karcie). Facebook ma pierwszeństwo nad LinkedIn. -->
            <a
              v-if="node.card.facebookUrl"
              :href="node.card.facebookUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-[5px] bg-[#1877f2] text-white shadow ring-2 ring-white transition hover:brightness-110"
              title="Profil Facebook"
              @click.stop
              @dblclick.stop
            >
              <svg viewBox="0 0 24 24" fill="currentColor" class="h-3 w-3"><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.02 4.39 11.01 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.08 24 18.09 24 12.07z"/></svg>
            </a>
            <a
              v-else-if="node.card.linkedinUrl"
              :href="node.card.linkedinUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-[5px] bg-[#0a66c2] text-white shadow ring-2 ring-white transition hover:brightness-110"
              title="Profil LinkedIn"
              @click.stop
              @dblclick.stop
            >
              <svg viewBox="0 0 24 24" fill="currentColor" class="h-3 w-3"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 110-4.13 2.06 2.06 0 010 4.13zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>
            </a>
          </div>
          <div class="min-w-0 flex-1">
            <div class="line-clamp-2 text-[13px] font-semibold leading-tight text-slate-800">
              {{ node.card.name }}
            </div>
            <div class="truncate text-[11px] leading-tight text-slate-500">
              {{ node.card.lifespan || '—' }}
            </div>
            <div v-if="node.card.birthplace" class="truncate text-[11px] leading-tight text-slate-400">
              ⌖ {{ node.card.birthplace }}
            </div>
          </div>
        </div>

        <!-- dół: rozwiń dzieci (gdy są ukryte) + „dodaj krewnego" (na hover) -->
        <div class="absolute -bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1">
          <button
            v-if="node.role !== 'spouse' && canExpandDown(node.card.id)"
            class="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 shadow hover:bg-slate-100"
            title="Pokaż dzieci"
            @click.stop="emit('expand-down', node.card.id)"
          >▼</button>
          <button
            class="hidden h-6 w-6 items-center justify-center rounded-full border border-amber-300 bg-white text-base leading-none text-amber-600 shadow hover:bg-amber-50 group-hover:flex"
            title="Dodaj krewnego"
            @click.stop="emit('add-relative', { id: node.card.id, name: node.card.name, x: $event.clientX, y: $event.clientY })"
          >+</button>
        </div>
      </div>

      <!-- placeholdery „+ Ojciec / + Matka" (osoby bez rodziców w drzewie, jak MyHeritage) -->
      <button
        v-for="(ph, i) in layout.placeholders"
        :key="'ph' + i"
        data-card
        class="absolute flex items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white/70 text-[11px] font-medium text-slate-400 transition hover:border-amber-400 hover:bg-amber-50 hover:text-amber-600"
        :style="{ left: ph.x + 'px', top: ph.y + 'px', width: ph.w + 'px', height: ph.h + 'px' }"
        :title="(ph.slot === 'father' ? 'Dodaj ojca' : 'Dodaj matkę') + ' — ' + ph.forName"
        @click.stop="emit('add-parent', { forId: ph.forId, slot: ph.slot })"
      >
        + {{ ph.slot === 'father' ? 'Ojciec' : 'Matka' }}
      </button>
    </div>

    <!-- kontrolki -->
    <div class="absolute bottom-4 right-4 flex flex-col gap-1.5">
      <button class="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 shadow hover:bg-slate-50" @click="scale = Math.min(2.5, scale * 1.2)">+</button>
      <button class="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 shadow hover:bg-slate-50" @click="scale = Math.max(0.2, scale / 1.2)">−</button>
      <button class="h-8 w-8 rounded-lg border border-slate-200 bg-white text-xs text-slate-600 shadow hover:bg-slate-50" title="Wyśrodkuj" @click="centerOnFocal">⌖</button>
    </div>
  </div>
</template>
