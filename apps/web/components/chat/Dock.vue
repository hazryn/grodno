<script setup lang="ts">
const chat = useChat();
const socket = useChatSocket();
const push = usePush();
const { isLoggedIn } = useAuth();
const { t } = useI18n();
const { openWindows, sheetOpen, totalUnread } = chat;

const newChatOpen = ref(false);
const openList = computed(() => openWindows.value.filter((w) => !w.minimized));
const minimizedList = computed(() => openWindows.value.filter((w) => w.minimized));

function startConnection(): void {
  socket.connect(chat.socketHandlers());
  void chat.loadConversations();
  void chat.loadContacts();
}
function openNewChat(): void {
  newChatOpen.value = true;
  chat.toggleSheet(false);
}

onMounted(async () => {
  if (!import.meta.client) return;
  startConnection();
  await push.register();
  push.onNotificationClick((id) => void chat.openConversation(id));
});
onBeforeUnmount(() => socket.disconnect());

watch(isLoggedIn, (v) => {
  if (v) startConnection();
  else {
    socket.disconnect();
    chat.reset();
  }
});
</script>

<template>
  <div>
    <div class="pointer-events-none fixed bottom-0 right-0 z-40 flex items-end gap-3 p-4">
      <ChatWindow
        v-for="w in openList"
        :key="w.conversationId"
        :conversation-id="w.conversationId"
        class="pointer-events-auto"
      />
      <div class="pointer-events-auto flex flex-col items-center gap-2">
        <ChatHead
          v-for="w in minimizedList"
          :key="w.conversationId"
          :conversation-id="w.conversationId"
        />
        <button
          class="relative flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-2xl shadow-lg transition hover:bg-amber-600"
          :title="t('chat.title')"
          @click="chat.toggleSheet()"
        >
          💬
          <span
            v-if="totalUnread"
            class="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white"
          >
            {{ totalUnread > 9 ? '9+' : totalUnread }}
          </span>
        </button>
      </div>
    </div>

    <ChatSheet :open="sheetOpen" @close="chat.toggleSheet(false)" @new-chat="openNewChat" />
    <ChatNewChat :open="newChatOpen" @close="newChatOpen = false" />
  </div>
</template>
