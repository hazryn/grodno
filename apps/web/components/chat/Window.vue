<script setup lang="ts">
import type { ChatMessage } from '~/composables/useChat';

const props = defineProps<{ conversationId: string }>();
const chat = useChat();
const socket = useChatSocket();
const { t } = useI18n();
const { relative } = useChatTime();

const conv = computed(() => chat.conversationById(props.conversationId));
const isGroup = computed(() => conv.value?.type === 'group');
const peer = computed(() => (conv.value ? chat.peer(conv.value) : null));
const title = computed(() =>
  isGroup.value ? conv.value?.title ?? t('chat.newGroup') : peer.value?.displayName ?? '—',
);
const online = computed(() => !isGroup.value && chat.isOnline(peer.value?.userId));
const subtitle = computed(() => {
  if (isGroup.value) {
    const n = conv.value?.participants.length ?? 0;
    return t('common.peopleCount', n, { n });
  }
  if (online.value) return t('chat.online');
  const ls = chat.lastSeenOf(peer.value?.userId) ?? peer.value?.lastSeenAt ?? null;
  return ls ? t('chat.lastSeen', { time: relative(ls) }) : '';
});

const editing = ref<ChatMessage | null>(null);
const settingsOpen = ref(false);

onMounted(async () => {
  await chat.loadMessages(props.conversationId);
  socket.join(props.conversationId);
  chat.markLatestRead(props.conversationId);
});
</script>

<template>
  <div
    v-if="conv"
    class="flex h-[26rem] w-72 flex-col overflow-hidden rounded-t-xl border border-slate-200 bg-white shadow-2xl sm:w-80"
  >
    <div class="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
      <ChatAvatar
        :photo-url="isGroup ? conv.photoUrl : peer?.photoUrl"
        :name="title"
        :sex="peer?.sex"
        :online="online"
        :show-presence="!isGroup"
        size="sm"
      />
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold text-slate-800">{{ title }}</p>
        <p class="truncate text-[11px] text-slate-400">{{ subtitle }}</p>
      </div>
      <button
        v-if="isGroup"
        class="rounded p-1 text-slate-400 hover:bg-slate-200"
        :title="t('chat.groupSettings')"
        @click="settingsOpen = true"
      >
        ⚙
      </button>
      <button class="rounded p-1 text-slate-400 hover:bg-slate-200" @click="chat.minimizeWindow(conversationId)">
        —
      </button>
      <button class="rounded p-1 text-slate-400 hover:bg-slate-200" @click="chat.closeWindow(conversationId)">
        ✕
      </button>
    </div>

    <ChatMessageList :conversation-id="conversationId" @edit="(m) => (editing = m)" />
    <ChatComposer :conversation-id="conversationId" :editing="editing" @cancel-edit="editing = null" />

    <ChatGroupSettings
      v-if="isGroup"
      :open="settingsOpen"
      :conversation-id="conversationId"
      @close="settingsOpen = false"
    />
  </div>
</template>
