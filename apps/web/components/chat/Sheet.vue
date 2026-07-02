<script setup lang="ts">
import type { ConversationDto } from '@rodno/shared';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'new-chat'): void }>();

const chat = useChat();
const { t } = useI18n();
const { relative } = useChatTime();
const { sortedConversations } = chat;

// Klik poza panelem zamyka (pomijamy ikonę-przełącznik w headerze, żeby nie odpalać podwójnie).
const panelRef = ref<HTMLElement | null>(null);
function onDocMouseDown(e: MouseEvent): void {
  const target = e.target as HTMLElement;
  if (panelRef.value && !panelRef.value.contains(target) && !target.closest('[data-chat-toggle]')) {
    emit('close');
  }
}
watch(
  () => props.open,
  (isOpen) => {
    if (!import.meta.client) return;
    if (isOpen) document.addEventListener('mousedown', onDocMouseDown);
    else document.removeEventListener('mousedown', onDocMouseDown);
  },
);
onBeforeUnmount(() => {
  if (import.meta.client) document.removeEventListener('mousedown', onDocMouseDown);
});

function convTitle(c: ConversationDto): string {
  return c.type === 'group' ? c.title ?? t('chat.newGroup') : chat.peer(c)?.displayName ?? '—';
}
function convPhoto(c: ConversationDto): string | null {
  return c.type === 'group' ? c.photoUrl : chat.peer(c)?.photoUrl ?? null;
}
function convOnline(c: ConversationDto): boolean {
  return c.type !== 'group' && chat.isOnline(chat.peer(c)?.userId);
}
function subtitle(c: ConversationDto): string {
  if (c.lastMessagePreview) return c.lastMessagePreview;
  return c.lastMessage?.type === 'image' ? t('chat.photo') : '';
}
function openConv(convId: string): void {
  void chat.openConversation(convId);
  emit('close');
}
</script>

<template>
  <!-- Panel dropdown pod headerem, z prawej. BEZ backdropu → drzewo zostaje klikalne.
       Uwaga: v-if="open" to PROP (nie myl z funkcją) — dlatego akcja otwarcia rozmowy
       nazywa się openConv, a nie open (kolizja nazw dawała v-if zawsze prawdziwe). -->
  <Transition name="chat-panel">
      <div
        v-if="open"
        ref="panelRef"
        class="fixed right-4 top-16 z-40 flex max-h-[75vh] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 class="text-base font-semibold text-slate-800">{{ t('chat.title') }}</h2>
          <div class="flex items-center gap-2">
            <button
              class="rounded-lg bg-amber-500 px-2.5 py-1 text-sm font-medium text-white hover:bg-amber-600"
              @click="emit('new-chat')"
            >
              {{ t('chat.newChat') }}
            </button>
            <button
              class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              :aria-label="t('common.close')"
              @click="emit('close')"
            >
              ✕
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto">
          <p v-if="!sortedConversations.length" class="p-6 text-center text-sm text-slate-400">
            {{ t('chat.noConversations') }}
          </p>
          <button
            v-for="c in sortedConversations"
            :key="c.id"
            class="flex w-full items-center gap-3 border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50"
            @click="openConv(c.id)"
          >
            <ChatAvatar
              :photo-url="convPhoto(c)"
              :name="convTitle(c)"
              :sex="chat.peer(c)?.sex"
              :online="convOnline(c)"
              :show-presence="c.type !== 'group'"
            />
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between gap-2">
                <p class="truncate text-sm font-semibold text-slate-800">{{ convTitle(c) }}</p>
                <span class="shrink-0 text-[11px] text-slate-400">{{ relative(c.lastMessageAt) }}</span>
              </div>
              <p class="truncate text-xs text-slate-500">{{ subtitle(c) }}</p>
            </div>
            <span
              v-if="c.unreadCount"
              class="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
            >
              {{ c.unreadCount > 9 ? '9+' : c.unreadCount }}
            </span>
          </button>
        </div>
      </div>
  </Transition>
</template>

<style scoped>
.chat-panel-enter-active,
.chat-panel-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}
.chat-panel-enter-from,
.chat-panel-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
