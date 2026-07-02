<script setup lang="ts">
import type { ConversationDto } from '@rodno/shared';

defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'new-chat'): void }>();

const chat = useChat();
const { t } = useI18n();
const { relative } = useChatTime();
const { sortedConversations } = chat;

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
function open(convId: string): void {
  void chat.openConversation(convId);
  emit('close');
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet-fade">
      <div v-if="open" class="fixed inset-0 z-50 bg-slate-900/30" @click.self="emit('close')">
        <Transition name="sheet-slide" appear>
          <div
            v-if="open"
            class="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col border-l border-slate-200 bg-white shadow-2xl"
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
                @click="open(c.id)"
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
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet-fade-enter-active,
.sheet-fade-leave-active {
  transition: opacity 0.2s ease;
}
.sheet-fade-enter-from,
.sheet-fade-leave-to {
  opacity: 0;
}
.sheet-slide-enter-active,
.sheet-slide-leave-active {
  transition: transform 0.25s ease;
}
.sheet-slide-enter-from,
.sheet-slide-leave-to {
  transform: translateX(100%);
}
</style>
