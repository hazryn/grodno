<script setup lang="ts">
import type { ChatMessage } from '~/composables/useChat';

const props = defineProps<{ conversationId: string }>();
const emit = defineEmits<{ (e: 'edit', m: ChatMessage): void }>();

const chat = useChat();
const { t } = useI18n();
const { messages, typing, meId } = chat;
const scroller = ref<HTMLElement | null>(null);

const list = computed<ChatMessage[]>(() => messages.value[props.conversationId] ?? []);
const conv = computed(() => chat.conversationById(props.conversationId));
const isGroup = computed(() => conv.value?.type === 'group');

function isAtBottom(): boolean {
  const el = scroller.value;
  if (!el) return true;
  return el.scrollHeight - el.scrollTop - el.clientHeight < 60;
}
function scrollToBottom(): void {
  nextTick(() => {
    const el = scroller.value;
    if (el) el.scrollTop = el.scrollHeight;
  });
}

const lastOwn = computed(() =>
  [...list.value].reverse().find((m) => m.senderId === meId.value && !m.deletedAt),
);
const readInfo = computed<string | null>(() => {
  const lo = lastOwn.value;
  const c = conv.value;
  if (!lo || !c) return null;
  const readers = c.participants.filter((p) => p.userId !== meId.value && p.lastReadSeq >= lo.seq);
  if (!readers.length) return null;
  return c.type === 'direct' ? t('chat.read') : t('chat.readByCount', { n: readers.length });
});

const typingNames = computed<string[]>(() => {
  const ids = typing.value[props.conversationId] ?? [];
  const c = conv.value;
  if (!c) return [];
  return ids
    .filter((id) => id !== meId.value)
    .map((id) => c.participants.find((p) => p.userId === id)?.displayName)
    .filter((x): x is string => !!x);
});

async function onScroll(): Promise<void> {
  const el = scroller.value;
  if (!el || el.scrollTop >= 40) return;
  const prevH = el.scrollHeight;
  const added = await chat.loadMore(props.conversationId);
  if (added)
    nextTick(() => {
      const el2 = scroller.value;
      if (el2) el2.scrollTop = el2.scrollHeight - prevH;
    });
}

function senderOf(m: ChatMessage) {
  return conv.value?.participants.find((p) => p.userId === m.senderId) ?? null;
}

watch(
  () => list.value.length,
  () => {
    if (isAtBottom()) scrollToBottom();
  },
);
onMounted(scrollToBottom);
</script>

<template>
  <div ref="scroller" class="flex-1 space-y-1.5 overflow-y-auto px-3 py-2" @scroll="onScroll">
    <ChatBubble
      v-for="m in list"
      :key="m.id"
      :message="m"
      :is-own="m.senderId === meId"
      :is-group="isGroup"
      :sender="senderOf(m)"
      @edit="(msg) => emit('edit', msg)"
    />
    <div v-if="readInfo" class="pr-1 text-right text-[10px] text-slate-400">{{ readInfo }}</div>
    <div v-if="typingNames.length" class="text-[11px] italic text-slate-400">
      {{
        typingNames.length === 1
          ? t('chat.typingOne', { name: typingNames[0] })
          : t('chat.typingMany', { names: typingNames.join(', ') })
      }}
    </div>
  </div>
</template>
