<script setup lang="ts">
import type { PendingUser, TreeSummary } from '~/composables/useApi';

definePageMeta({ middleware: 'auth' });

const api = useApi();
const config = useRuntimeConfig();
const { success, error } = useToast();

const pending = ref<PendingUser[]>([]);
const tree = ref<TreeSummary | null>(null);
const loading = ref(true);
const assigningFor = ref<string | null>(null);

async function load() {
  loading.value = true;
  try {
    [pending.value, tree.value] = await Promise.all([
      api.adminPendingUsers(),
      api.tree(config.public.treeName as string),
    ]);
  } catch {
    error('Nie udało się wczytać kolejki kont.');
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function fullName(u: PendingUser): string {
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.displayName || u.email;
}

async function assign(userId: string, individualId: string) {
  try {
    await api.adminAssignIndividual(userId, individualId);
    pending.value = pending.value.filter((u) => u.id !== userId);
    assigningFor.value = null;
    success('Konto aktywowane — wysłano e-mail z informacją.');
  } catch {
    error('Nie udało się przypisać osoby.');
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <header class="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3 shadow-sm">
      <div class="flex items-baseline gap-3">
        <span class="text-lg font-bold tracking-tight text-amber-500">{{ config.public.appTitle }}</span>
        <span class="text-sm text-slate-400">Konta — prośby o dostęp</span>
      </div>
      <NuxtLink
        to="/tree"
        class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50"
      >
        ← Drzewo
      </NuxtLink>
    </header>

    <main class="mx-auto max-w-3xl px-6 py-8">
      <div v-if="loading" class="py-16 text-center text-slate-400">Wczytywanie…</div>

      <div
        v-else-if="!pending.length"
        class="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-400"
      >
        Brak oczekujących kont. Gdy ktoś poprosi o dostęp adresem spoza drzewa, pojawi się tutaj.
      </div>

      <ul v-else class="space-y-3">
        <li
          v-for="u in pending"
          :key="u.id"
          class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div class="flex items-center justify-between gap-4">
            <div class="min-w-0">
              <div class="truncate text-sm font-semibold text-slate-800">{{ fullName(u) }}</div>
              <div class="truncate text-sm text-slate-400">{{ u.email }}</div>
            </div>
            <button
              v-if="assigningFor !== u.id"
              class="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600"
              @click="assigningFor = u.id"
            >
              Przypisz osobę
            </button>
            <button
              v-else
              class="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50"
              @click="assigningFor = null"
            >
              Anuluj
            </button>
          </div>

          <div v-if="assigningFor === u.id" class="mt-3 border-t border-slate-100 pt-3">
            <p class="mb-2 text-xs text-slate-400">
              Wyszukaj osobę w drzewie, do której przypisać to konto:
            </p>
            <SearchBox v-if="tree" :tree-id="tree.id" @select="(id) => assign(u.id, id)" />
            <p v-else class="text-xs text-rose-500">Brak drzewa — sprawdź konfigurację.</p>
          </div>
        </li>
      </ul>
    </main>
  </div>
</template>
