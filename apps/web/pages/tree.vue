<script setup lang="ts">
import { TreeGraph, type TreeLayout } from '../utils/treeGraph';
import type { TreeSummary } from '../composables/useApi';

definePageMeta({ middleware: 'auth' });

const { t } = useI18n();

const api = useApi();
const route = useRoute();
const router = useRouter();
const config = useRuntimeConfig();
const { user } = useAuth();
const { totalUnread: unreadChat, toggleSheet: toggleChat } = useChat();
const graph = new TreeGraph();
const layout = shallowRef<TreeLayout>({ nodes: [], links: [], width: 0, height: 0 });
const focalId = ref('');
const tree = ref<TreeSummary | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const modalId = ref<string | null>(null);

const appTitle = config.public.appTitle as string;
const familyName = config.public.familyName as string;

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
  showToast(
    slot === 'father'
      ? t('tree.toastAddParentFather', { name: who })
      : t('tree.toastAddParentMother', { name: who }),
  );
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
  showToast(t('tree.toastAddRelative', { label, name: who }));
}

onMounted(async () => {
  try {
    tree.value = await api.tree(config.public.treeName as string);
    const urlId = typeof route.query.p === 'string' ? route.query.p : null;
    // Centrowanie: URL > osoba zalogowanego (na sobie) > domyślny focal drzewa.
    const start = urlId ?? user.value?.individualId ?? tree.value.focalId;
    if (start) {
      try {
        await focusOn(start, true);
      } catch {
        // id z URL/usera nieaktualne (np. po re-imporcie zmieniły się UUID-y) → domyślna osoba
        if (tree.value.focalId && start !== tree.value.focalId) {
          await focusOn(tree.value.focalId, true);
        }
      }
    } else {
      error.value = t('tree.errorEmpty');
    }
  } catch (e) {
    error.value = t('tree.errorApi');
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
    <header class="z-10 flex items-center gap-4 border-b border-slate-200 bg-white px-5 py-3 shadow-sm">
      <div class="flex min-w-0 flex-1 items-baseline gap-3">
        <h1 class="shrink-0 text-lg font-bold tracking-tight text-slate-800">
          <span class="text-amber-500">{{ appTitle }}</span>
        </h1>
        <span v-if="tree" class="min-w-0 truncate text-sm text-slate-400">
          {{ $t('tree.treeLabel', { name: familyName || tree.name }) }} · {{ $t('common.peopleCount', tree.individualCount, { n: tree.individualCount }) }}
        </span>
      </div>
      <div class="flex-none">
        <SearchBox v-if="tree" :tree-id="tree.id" @select="(id) => focusOn(id, true)" />
      </div>
      <div class="flex flex-1 items-center justify-end gap-2">
        <button
          class="rounded-lg px-2.5 py-1.5 text-slate-500 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          :title="$t('chat.title')"
          data-chat-toggle
          @click="toggleChat()"
        >
          <span class="relative block">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="h-[1.35rem] w-[1.35rem]">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 12h.01m3.74 0h.01m3.74 0h.01M21 12c0 4.556-4.03 8.25-9 8.25a9.76 9.76 0 0 1-2.555-.337A5.97 5.97 0 0 1 5.41 20.97a5.97 5.97 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
            </svg>
            <span
              v-if="unreadChat"
              class="absolute -right-2 -top-2 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white"
            >
              {{ unreadChat > 9 ? '9+' : unreadChat }}
            </span>
          </span>
        </button>
        <CommonUserMenu v-model:display-mode="displayMode" />
      </div>
    </header>

    <!-- tree -->
    <main class="relative flex-1 overflow-hidden">
      <div v-if="loading" class="flex h-full items-center justify-center text-slate-400">
        {{ $t('tree.loading') }}
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
        <div class="mb-1 font-medium text-slate-600">{{ $t('tree.legend.title') }}</div>
        <div>{{ $t('tree.legend.line1') }}</div>
        <div>{{ $t('tree.legend.line2') }}</div>
        <div class="mt-1.5 flex items-center gap-3 border-t border-slate-100 pt-1.5">
          <span class="flex items-center gap-1"><span class="inline-block h-[3px] w-4 rounded" style="background:#e11d48"></span> {{ $t('tree.legend.married') }}</span>
          <span class="flex items-center gap-1"><span class="inline-block h-[3px] w-4 rounded" style="background:#0d9488"></span> {{ $t('tree.legend.partner') }}</span>
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
