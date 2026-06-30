<script setup lang="ts">
import { TreeGraph, type TreeLayout } from '../utils/treeGraph';
import type { TreeSummary } from '../composables/useApi';

const api = useApi();
const route = useRoute();
const router = useRouter();
const graph = new TreeGraph();
const layout = shallowRef<TreeLayout>({ nodes: [], links: [], width: 0, height: 0 });
const focalId = ref('');
const tree = ref<TreeSummary | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const modalId = ref<string | null>(null);

function relayout() {
  if (focalId.value) layout.value = graph.layout(focalId.value);
}

const treeRef = ref<{ centerOnFocal: () => void } | null>(null);

async function focusOn(id: string, deep = false) {
  focalId.value = id;
  if (deep || !graph.expanded.has(id)) {
    const payload = await api.payload(id, 4, 2);
    graph.ingestPayload(payload);
  }
  relayout();
  // Centruj na osobie DOPIERO po przebudowie layoutu (na nowej pozycji focal-a).
  await nextTick();
  treeRef.value?.centerOnFocal();
  // Zapisz aktywną osobę w URL (?p=id) — F5 nie resetuje widoku.
  if (route.query.p !== id) router.replace({ query: { ...route.query, p: id } });
}

async function expandUp(id: string) {
  const b = await api.bundle(id);
  graph.ingestBundle(b);
  // dociągnij też rodziców (żeby od razu mieli swoje flagi +/−)
  await Promise.all(
    [b.father?.id, b.mother?.id].filter((x): x is string => !!x).map(async (pid) => {
      if (!graph.expanded.has(pid)) graph.ingestBundle(await api.bundle(pid));
    }),
  );
  relayout();
}

async function expandDown(id: string) {
  const b = await api.bundle(id);
  graph.ingestBundle(b);
  await Promise.all(
    b.children.map(async (c) => {
      if (!graph.expanded.has(c.id)) graph.ingestBundle(await api.bundle(c.id));
    }),
  );
  relayout();
}

const canExpandUp = (id: string) => graph.canExpandUp(id);
const canExpandDown = (id: string) => graph.canExpandDown(id);

// Domyślnie panel boczny (sheet); docelowo opcja w profilu użytkownika.
const displayMode = ref<'sheet' | 'modal'>('sheet');

const toast = ref<string | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | null = null;
function showToast(msg: string) {
  toast.value = msg;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = null), 3500);
}
function onAddParent({ slot, forId }: { forId: string; slot: 'father' | 'mother' }) {
  const who = graph.cards.get(forId)?.name ?? 'osoby';
  showToast(`Dodawanie ${slot === 'father' ? 'ojca' : 'matki'} dla „${who}" — edycja w fazie 2.`);
}

const addMenu = ref<
  { id: string; name: string; x: number; y: number; hasFather: boolean; hasMother: boolean } | null
>(null);

async function openAddMenu(p: { id: string; name: string; x: number; y: number }) {
  // Upewnij się, że znamy rodziców (dociągnij bundle, jeśli to karta bez własnego bundla).
  let info = graph.parentInfo(p.id);
  if (!info.known) {
    try {
      graph.ingestBundle(await api.bundle(p.id));
      info = graph.parentInfo(p.id);
    } catch {
      /* ignoruj — pokaż menu bez wyszarzeń */
    }
  }
  addMenu.value = { ...p, hasFather: info.hasFather, hasMother: info.hasMother };
}

function onAddRelative(label: string) {
  const who = addMenu.value?.name ?? 'osoby';
  addMenu.value = null;
  showToast(`${label} (dla „${who}") — edycja w fazie 2.`);
}

onMounted(async () => {
  try {
    tree.value = await api.tree('szejna');
    const urlId = typeof route.query.p === 'string' ? route.query.p : null;
    const start = urlId ?? tree.value.focalId;
    if (start) {
      try {
        await focusOn(start, true);
      } catch {
        // id z URL nieaktualne (np. po re-imporcie zmieniły się UUID-y) → domyślna osoba
        if (tree.value.focalId && start !== tree.value.focalId) {
          await focusOn(tree.value.focalId, true);
        }
      }
    } else {
      error.value = 'Drzewo jest puste — uruchom import GEDCOM.';
    }
  } catch (e) {
    error.value = 'Nie mogę połączyć się z API (http://localhost:5201). Czy backend działa?';
  } finally {
    loading.value = false;
  }
});

function onRecenter(id: string) {
  modalId.value = null;
  focusOn(id, true);
}

/** Po edycji osoby — odśwież jej kafelek (imię/avatar/lifespan) w drzewie. */
async function onPersonChanged(id: string) {
  try {
    graph.ingestBundle(await api.bundle(id));
    relayout();
  } catch {
    /* ignoruj — kafelek odświeży się przy następnym dociągnięciu */
  }
}
</script>

<template>
  <div class="flex h-screen flex-col bg-slate-50">
    <!-- header -->
    <header class="z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-3 shadow-sm">
      <div class="flex items-baseline gap-3">
        <h1 class="text-lg font-bold tracking-tight text-slate-800">
          <span class="text-amber-500">Rodno</span>
        </h1>
        <span v-if="tree" class="text-sm text-slate-400">
          drzewo „{{ tree.name }}" · {{ tree.individualCount }} osób
        </span>
      </div>
      <div class="flex items-center gap-3">
        <div class="flex rounded-lg border border-slate-200 p-0.5 text-xs font-medium">
          <button
            class="rounded-md px-2.5 py-1 transition"
            :class="displayMode === 'sheet' ? 'bg-amber-100 text-amber-700' : 'text-slate-500 hover:bg-slate-50'"
            @click="displayMode = 'sheet'"
          >
            Panel
          </button>
          <button
            class="rounded-md px-2.5 py-1 transition"
            :class="displayMode === 'modal' ? 'bg-amber-100 text-amber-700' : 'text-slate-500 hover:bg-slate-50'"
            @click="displayMode = 'modal'"
          >
            Okno
          </button>
        </div>
        <SearchBox v-if="tree" :tree-id="tree.id" @select="(id) => focusOn(id, true)" />
      </div>
    </header>

    <!-- tree -->
    <main class="relative flex-1 overflow-hidden">
      <div v-if="loading" class="flex h-full items-center justify-center text-slate-400">
        Wczytywanie drzewa…
      </div>
      <div v-else-if="error" class="flex h-full items-center justify-center">
        <div class="max-w-md rounded-xl border border-amber-200 bg-amber-50 px-6 py-4 text-center text-sm text-amber-800">
          {{ error }}
        </div>
      </div>
      <TreeCanvas
        v-else
        ref="treeRef"
        :layout="layout"
        :focal-id="focalId"
        :can-expand-up="canExpandUp"
        :can-expand-down="canExpandDown"
        @select="(id) => (modalId = id)"
        @recenter="(id) => focusOn(id, true)"
        @expand-up="expandUp"
        @expand-down="expandDown"
        @add-parent="onAddParent"
        @add-relative="openAddMenu"
      />

      <!-- legenda -->
      <div class="pointer-events-none absolute left-4 top-4 rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-500 shadow-sm backdrop-blur">
        <div class="mb-1 font-medium text-slate-600">Sterowanie</div>
        <div>Klik kafelka → szczegóły · dwuklik → centruj</div>
        <div>▲ / ▼ → rozwiń rodziców / dzieci · scroll → zoom</div>
        <div class="mt-1.5 flex items-center gap-3 border-t border-slate-100 pt-1.5">
          <span class="flex items-center gap-1"><span class="inline-block h-[3px] w-4 rounded" style="background:#e11d48"></span> ślub</span>
          <span class="flex items-center gap-1"><span class="inline-block h-[3px] w-4 rounded" style="background:#0d9488"></span> partner</span>
        </div>
      </div>
    </main>

    <PersonSheet
      v-if="displayMode === 'sheet'"
      :individual-id="modalId"
      @close="modalId = null"
      @recenter="onRecenter"
      @changed="onPersonChanged"
    />
    <PersonModal
      v-else
      :individual-id="modalId"
      @close="modalId = null"
      @recenter="onRecenter"
      @changed="onPersonChanged"
    />

    <AddRelativeMenu :open="addMenu" @close="addMenu = null" @pick="onAddRelative" />

    <!-- toast aplikacyjny (zamiast natywnego dialogu) -->
    <div
      v-if="toast"
      class="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm text-white shadow-lg"
    >
      {{ toast }}
    </div>
  </div>
</template>
