<script setup lang="ts">
const chat = useChat();
const socket = useChatSocket();
const push = usePush();
const { isLoggedIn } = useAuth();
const { openWindows, sheetOpen } = chat;

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
    <!-- Otwarte rozmowy (okna) + zminimalizowane (chat-heady) w prawym dolnym rogu.
         Wejście do listy rozmów jest w headerze (ikona z licznikiem) — nie tutaj. -->
    <div class="pointer-events-none fixed bottom-0 right-0 z-40 flex items-end gap-3 p-4">
      <ChatWindow
        v-for="w in openList"
        :key="w.conversationId"
        :conversation-id="w.conversationId"
        class="pointer-events-auto"
      />
      <div v-if="minimizedList.length" class="pointer-events-auto flex flex-col items-center gap-2">
        <ChatHead
          v-for="w in minimizedList"
          :key="w.conversationId"
          :conversation-id="w.conversationId"
        />
      </div>
    </div>

    <ChatSheet :open="sheetOpen" @close="chat.toggleSheet(false)" @new-chat="openNewChat" />
    <ChatNewChat :open="newChatOpen" @close="newChatOpen = false" />
  </div>
</template>
