<script setup lang="ts">
const props = defineProps<{ conversationId: string }>();
const chat = useChat();

const conv = computed(() => chat.conversationById(props.conversationId));
const isGroup = computed(() => conv.value?.type === 'group');
const peer = computed(() => (conv.value ? chat.peer(conv.value) : null));
const title = computed(() =>
  isGroup.value ? conv.value?.title ?? '' : peer.value?.displayName ?? '',
);
const online = computed(() => !isGroup.value && chat.isOnline(peer.value?.userId));
const unread = computed(() => conv.value?.unreadCount ?? 0);
</script>

<template>
  <button v-if="conv" class="relative" :title="title" @click="chat.openWindow(conversationId)">
    <ChatAvatar
      :photo-url="isGroup ? conv.photoUrl : peer?.photoUrl"
      :name="title"
      :sex="peer?.sex"
      :online="online"
      :show-presence="!isGroup"
      size="lg"
    />
    <span
      v-if="unread"
      class="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
    >
      {{ unread > 9 ? '9+' : unread }}
    </span>
  </button>
</template>
