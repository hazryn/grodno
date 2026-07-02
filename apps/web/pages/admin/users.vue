<script setup lang="ts">
import type { AdminUser, TreeSummary } from '~/composables/useApi';

definePageMeta({ middleware: 'auth' });

const { t } = useI18n();
const localePath = useLocalePath();
const api = useApi();
const config = useRuntimeConfig();
const { success, error } = useToast();
const { ask } = useConfirm();
const { user: me } = useAuth();
const chat = useChat();

const users = ref<AdminUser[]>([]);
const tree = ref<TreeSummary | null>(null);
const loading = ref(true);
const changingFor = ref<string | null>(null);
const filter = ref<'all' | 'pending' | 'active'>('all');

const STATUS: Record<AdminUser['status'], { label: string; cls: string }> = {
  active: { label: 'admin.statusActive', cls: 'bg-emerald-100 text-emerald-700' },
  pending: { label: 'admin.statusPending', cls: 'bg-amber-100 text-amber-700' },
  invited: { label: 'admin.statusInvited', cls: 'bg-slate-100 text-slate-500' },
};
const FILTERS = [
  { key: 'all', label: 'admin.filterAll' },
  { key: 'pending', label: 'admin.filterPending' },
  { key: 'active', label: 'admin.filterActive' },
] as const;

const counts = computed(() => ({
  all: users.value.length,
  pending: users.value.filter((u) => u.status !== 'active').length,
  active: users.value.filter((u) => u.status === 'active').length,
}));
const filtered = computed(() => {
  if (filter.value === 'active') return users.value.filter((u) => u.status === 'active');
  if (filter.value === 'pending') return users.value.filter((u) => u.status !== 'active');
  return users.value;
});

async function load() {
  loading.value = true;
  try {
    [users.value, tree.value] = await Promise.all([
      api.adminUsers(),
      api.tree(config.public.treeName as string),
    ]);
  } catch {
    error(t('admin.errorLoad'));
  } finally {
    loading.value = false;
  }
}
onMounted(load);

async function reassign(userId: string, individualId: string) {
  try {
    const updated = await api.adminAssignIndividual(userId, individualId);
    const i = users.value.findIndex((u) => u.id === userId);
    if (i >= 0) users.value[i] = updated;
    changingFor.value = null;
    success(t('admin.successAssign'));
  } catch {
    error(t('admin.errorAssign'));
  }
}

function accountName(u: AdminUser): string {
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.displayName;
}
function canMessage(u: AdminUser): boolean {
  return !!me.value?.individualId && u.isActive && !!u.person?.isLiving && u.id !== me.value?.id;
}
async function message(u: AdminUser) {
  try {
    await chat.openDirect(u.id);
  } catch {
    error(t('chat.notContactable'));
  }
}
async function remove(u: AdminUser) {
  const ok = await ask({
    title: t('admin.deleteConfirm', { name: accountName(u) }),
    message: u.email,
    confirmLabel: t('admin.delete'),
    danger: true,
  });
  if (!ok) return;
  try {
    await api.adminDeleteUser(u.id);
    users.value = users.value.filter((x) => x.id !== u.id);
    success(t('admin.successDelete'));
  } catch {
    error(t('admin.errorDelete'));
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <header class="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3 shadow-sm">
      <div class="flex items-baseline gap-3">
        <span class="text-lg font-bold tracking-tight text-amber-500">{{ config.public.appTitle }}</span>
        <span class="text-sm text-slate-400">{{ $t('admin.title') }}</span>
      </div>
      <NuxtLink
        :to="localePath('/tree')"
        class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50"
      >
        {{ $t('admin.back') }}
      </NuxtLink>
    </header>

    <main class="mx-auto max-w-3xl px-6 py-8">
      <div v-if="loading" class="py-16 text-center text-slate-400">{{ $t('admin.loading') }}</div>

      <template v-else>
        <!-- filtry -->
        <div class="mb-4 flex w-fit gap-1 rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-medium">
          <button
            v-for="f in FILTERS"
            :key="f.key"
            class="rounded-md px-3 py-1.5 transition"
            :class="filter === f.key ? 'bg-amber-100 text-amber-700' : 'text-slate-500 hover:bg-slate-50'"
            @click="filter = f.key"
          >
            {{ t(f.label) }} <span class="text-slate-400">({{ counts[f.key] }})</span>
          </button>
        </div>

        <p
          v-if="!filtered.length"
          class="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-400"
        >
          {{ $t('admin.emptyAll') }}
        </p>

        <ul v-else class="space-y-3">
          <li
            v-for="u in filtered"
            :key="u.id"
            class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div class="flex items-start gap-3">
              <ChatAvatar
                :photo-url="u.person?.photoUrl"
                :name="u.person?.name || accountName(u)"
                :sex="u.person?.sex"
              />
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="truncate text-sm font-semibold" :class="u.person ? 'text-slate-800' : 'text-slate-400'">
                    {{ u.person?.name || $t('admin.noPerson') }}
                  </span>
                  <span class="rounded-full px-2 py-0.5 text-[11px] font-medium" :class="STATUS[u.status].cls">
                    {{ t(STATUS[u.status].label) }}
                  </span>
                  <span v-if="u.role === 'admin'" class="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                    {{ $t('admin.roleAdmin') }}
                  </span>
                  <span v-if="u.id === me?.id" class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                    {{ $t('admin.you') }}
                  </span>
                </div>
                <div class="mt-0.5 truncate text-xs text-slate-500">
                  {{ $t('admin.account') }}: {{ accountName(u) }} · <span class="text-slate-400">{{ u.email }}</span>
                </div>

                <div class="mt-2.5 flex flex-wrap items-center gap-2">
                  <NuxtLink
                    v-if="u.individualId"
                    :to="{ path: localePath('/tree'), query: { p: u.individualId } }"
                    class="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    ⌖ {{ $t('admin.centerTree') }}
                  </NuxtLink>
                  <button
                    v-if="canMessage(u)"
                    class="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-amber-600"
                    @click="message(u)"
                  >
                    ✉ {{ $t('admin.message') }}
                  </button>
                  <button
                    v-if="changingFor !== u.id"
                    class="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                    @click="changingFor = u.id"
                  >
                    {{ u.individualId ? $t('admin.changePerson') : $t('admin.assignPerson') }}
                  </button>
                  <button
                    v-else
                    class="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-400 transition hover:bg-slate-100"
                    @click="changingFor = null"
                  >
                    {{ $t('admin.cancel') }}
                  </button>
                  <button
                    v-if="u.id !== me?.id"
                    class="ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                    @click="remove(u)"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="h-3.5 w-3.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.457 0a48.11 48.11 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                    {{ $t('admin.delete') }}
                  </button>
                </div>

                <div v-if="changingFor === u.id" class="mt-3 border-t border-slate-100 pt-3">
                  <p class="mb-2 text-xs text-slate-400">{{ $t('admin.assignInstruction') }}</p>
                  <SearchBox v-if="tree" :tree-id="tree.id" @select="(id) => reassign(u.id, id)" />
                  <p v-else class="text-xs text-rose-500">{{ $t('admin.noTree') }}</p>
                </div>
              </div>
            </div>
          </li>
        </ul>
      </template>
    </main>
  </div>
</template>
