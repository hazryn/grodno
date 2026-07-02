<script setup lang="ts">
/**
 * Menu użytkownika (dropdown z imienia+awatara). Konsoliduje rozproszone kontrolki
 * headera: ustawienia, konta (admin), język, tryb otwierania osoby, wylogowanie.
 * Zamykane klikiem poza, Esc oraz po nawigacji. Tag: <CommonUserMenu>.
 */
const props = defineProps<{ displayMode: 'sheet' | 'modal' }>();
const emit = defineEmits<{ (e: 'update:displayMode', v: 'sheet' | 'modal'): void }>();

const { user, isAdmin, logout } = useAuth();
const { t, locale, locales } = useI18n();
const localePath = useLocalePath();
const switchLocalePath = useSwitchLocalePath();
const { updateLocale } = useAuth();

const open = ref(false);
const root = ref<HTMLElement | null>(null);

const langs = computed(() => locales.value as Array<{ code: string; name?: string }>);
const initials = computed(() =>
  (user.value?.displayName ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || '?',
);

function toggle(): void {
  open.value = !open.value;
}
function close(): void {
  open.value = false;
}
function onDocDown(e: MouseEvent): void {
  if (root.value && !root.value.contains(e.target as Node)) close();
}
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') close();
}
watch(open, (isOpen) => {
  if (!import.meta.client) return;
  if (isOpen) {
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
  } else {
    document.removeEventListener('mousedown', onDocDown);
    document.removeEventListener('keydown', onKey);
  }
});
onBeforeUnmount(() => {
  if (!import.meta.client) return;
  document.removeEventListener('mousedown', onDocDown);
  document.removeEventListener('keydown', onKey);
});

async function switchLang(code: string): Promise<void> {
  if (code === locale.value) return;
  try {
    await updateLocale(code);
  } catch {
    /* i tak przełącz interfejs */
  }
  await navigateTo(switchLocalePath(code));
}
function setDisplay(v: 'sheet' | 'modal'): void {
  emit('update:displayMode', v);
}
async function onLogout(): Promise<void> {
  close();
  logout();
  await navigateTo(localePath('/login'));
}
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="toggle"
    >
      <span
        class="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-700"
      >
        {{ initials }}
      </span>
      <span class="hidden max-w-[10rem] truncate text-sm font-medium text-slate-600 sm:inline">
        {{ user?.displayName }}
      </span>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        class="h-4 w-4 text-slate-400 transition-transform"
        :class="{ 'rotate-180': open }"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
      </svg>
    </button>

    <Transition name="usermenu">
      <div
        v-if="open"
        role="menu"
        class="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg ring-1 ring-slate-900/5"
      >
        <!-- nagłówek konta -->
        <div class="flex items-center gap-3 px-4 py-3">
          <span
            class="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-700"
          >
            {{ initials }}
          </span>
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-slate-800">{{ user?.displayName }}</p>
            <p class="truncate text-xs text-slate-400">{{ user?.email }}</p>
          </div>
        </div>

        <div class="border-t border-slate-100 py-1">
          <NuxtLink
            :to="localePath('/settings')"
            role="menuitem"
            class="flex items-center gap-3 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
            @click="close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="h-[1.15rem] w-[1.15rem] text-slate-400">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.128.324.196.72.257 1.075.124l1.217-.456c.5-.188 1.06.008 1.37.49l1.296 2.247c.28.483.16 1.106-.28 1.431l-1.003.827c-.293.241-.438.613-.43.992a6.9 6.9 0 0 1 0 .255c-.008.378.137.75.43.992l1.004.827c.44.325.56.948.28 1.431l-1.297 2.247c-.31.482-.87.678-1.37.49l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.5 6.5 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.5 6.5 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456c-.5.188-1.06-.008-1.37-.49l-1.296-2.247a1.125 1.125 0 0 1 .28-1.431l1.003-.827c.293-.242.438-.614.43-.993a7 7 0 0 1 0-.254c.008-.38-.137-.751-.43-.993l-1.003-.827a1.125 1.125 0 0 1-.28-1.43l1.296-2.248c.31-.482.87-.678 1.37-.49l1.217.456c.355.133.75.072 1.076-.124.072-.044.146-.086.22-.128.331-.183.581-.494.644-.868l.213-1.281Z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            {{ t('tree.settings') }}
          </NuxtLink>

          <NuxtLink
            v-if="isAdmin"
            :to="localePath('/admin/users')"
            role="menuitem"
            class="flex items-center gap-3 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
            @click="close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="h-[1.15rem] w-[1.15rem] text-slate-400">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.34 9.34 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.32 12.32 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
            {{ t('tree.accounts') }}
          </NuxtLink>
        </div>

        <!-- język -->
        <div class="border-t border-slate-100 px-4 py-2.5">
          <p class="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {{ t('settings.language') }}
          </p>
          <div class="flex gap-1">
            <button
              v-for="l in langs"
              :key="l.code"
              type="button"
              class="flex-1 rounded-md px-2 py-1 text-xs font-semibold uppercase transition"
              :class="l.code === locale ? 'bg-amber-100 text-amber-700' : 'text-slate-400 hover:bg-slate-100'"
              @click="switchLang(l.code)"
            >
              {{ l.code }}
            </button>
          </div>
        </div>

        <!-- tryb otwierania osoby -->
        <div class="border-t border-slate-100 px-4 py-2.5">
          <p class="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {{ t('tree.displayModeLabel') }}
          </p>
          <div class="flex gap-1">
            <button
              type="button"
              class="flex-1 rounded-md px-2 py-1 text-xs font-medium transition"
              :class="displayMode === 'sheet' ? 'bg-amber-100 text-amber-700' : 'text-slate-400 hover:bg-slate-100'"
              @click="setDisplay('sheet')"
            >
              {{ t('tree.displayPanel') }}
            </button>
            <button
              type="button"
              class="flex-1 rounded-md px-2 py-1 text-xs font-medium transition"
              :class="displayMode === 'modal' ? 'bg-amber-100 text-amber-700' : 'text-slate-400 hover:bg-slate-100'"
              @click="setDisplay('modal')"
            >
              {{ t('tree.displayModal') }}
            </button>
          </div>
        </div>

        <!-- wyloguj (wyraźnie oddzielone, destrukcyjne) -->
        <div class="border-t border-slate-100 py-1">
          <button
            type="button"
            role="menuitem"
            class="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 transition hover:bg-red-50"
            @click="onLogout"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="h-[1.15rem] w-[1.15rem]">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
            </svg>
            {{ t('tree.logout') }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.usermenu-enter-active,
.usermenu-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.usermenu-enter-from,
.usermenu-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}
</style>
