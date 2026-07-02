<script setup lang="ts">
import type { ChatParticipant } from '@rodno/shared';
import type { ChatMessage } from '~/composables/useChat';

const props = defineProps<{
  message: ChatMessage;
  isOwn: boolean;
  isGroup: boolean;
  sender: ChatParticipant | null;
}>();
const emit = defineEmits<{ (e: 'edit', m: ChatMessage): void }>();

const chat = useChat();
const { t } = useI18n();
const { time } = useChatTime();
const { ask } = useConfirm();

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const SYS_KEYS: Record<string, string> = {
  'group.created': 'chat.system.groupCreated',
  'group.renamed': 'chat.system.groupRenamed',
  'member.added': 'chat.system.memberAdded',
  'member.removed': 'chat.system.memberRemoved',
  'member.left': 'chat.system.memberLeft',
};

const pickerOpen = ref(false);
const menuOpen = ref(false);
const preview = ref<string | null>(null);

const deleted = computed(() => !!props.message.deletedAt);
const isSystem = computed(() => props.message.type === 'system');
const canTranslate = computed(() => !props.isOwn && !deleted.value && !!props.message.body);
const bubbleText = computed(() => {
  const tr = props.message._translation;
  return tr?.showing && tr.text ? tr.text : props.message.body ?? '';
});

async function react(emoji: string): Promise<void> {
  pickerOpen.value = false;
  const mine = props.message.reactions.find((r) => r.emoji === emoji)?.mine ?? false;
  await chat.toggleReaction(props.message.id, emoji, mine);
}
async function unsend(): Promise<void> {
  menuOpen.value = false;
  if (
    await ask({
      title: t('chat.unsend'),
      message: t('chat.unsendConfirm'),
      confirmLabel: t('chat.unsend'),
      danger: true,
    })
  ) {
    await chat.deleteMessage(props.message.conversationId, props.message.id);
  }
}
function startEdit(): void {
  menuOpen.value = false;
  emit('edit', props.message);
}
function systemText(): string {
  return t(SYS_KEYS[props.message.systemKind ?? ''] ?? 'chat.system.generic');
}
</script>

<template>
  <!-- systemowe -->
  <div v-if="isSystem" class="my-1 text-center text-[11px] text-slate-400">
    {{ systemText() }}
  </div>

  <div v-else class="group flex flex-col" :class="isOwn ? 'items-end' : 'items-start'">
    <span v-if="isGroup && !isOwn && sender" class="mb-0.5 ml-1 text-[11px] text-slate-400">
      {{ sender.displayName }}
    </span>

    <div class="flex items-end gap-1" :class="isOwn ? 'flex-row-reverse' : 'flex-row'">
      <!-- dymek -->
      <div
        class="relative max-w-[15rem] rounded-2xl px-3 py-1.5 text-sm"
        :class="[
          isOwn ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-800',
          deleted ? 'italic opacity-70' : '',
        ]"
      >
        <template v-if="deleted">{{ t('chat.deleted') }}</template>
        <template v-else>
          <div v-if="message.attachments.length" class="mb-1 grid grid-cols-2 gap-1">
            <img
              v-for="a in message.attachments"
              :key="a.id"
              :src="a.url ?? ''"
              class="h-24 w-full cursor-pointer rounded-lg object-cover"
              @click="preview = a.url"
            />
          </div>
          <p v-if="bubbleText" class="whitespace-pre-wrap break-words">{{ bubbleText }}</p>
          <div class="mt-0.5 flex items-center gap-1 text-[10px]" :class="isOwn ? 'text-amber-100' : 'text-slate-400'">
            <span>{{ time(message.createdAt) }}</span>
            <span v-if="message.editedAt">· {{ t('chat.edited') }}</span>
            <span v-if="message._status === 'sending'">· {{ t('chat.sending') }}</span>
            <button
              v-if="message._status === 'failed'"
              class="underline"
              @click="chat.retry(message.conversationId, message._tempId!)"
            >
              {{ t('chat.retry') }}
            </button>
          </div>
        </template>
      </div>

      <!-- akcje (hover) -->
      <div
        v-if="!deleted"
        class="relative flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100"
      >
        <button
          class="rounded-full p-1 text-slate-400 hover:bg-slate-100"
          :title="t('chat.react')"
          @click="pickerOpen = !pickerOpen"
        >
          🙂
        </button>
        <button
          class="rounded-full p-1 text-slate-400 hover:bg-slate-100"
          @click="menuOpen = !menuOpen"
        >
          ⋯
        </button>

        <div
          v-if="pickerOpen"
          class="absolute bottom-8 z-10 flex gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 shadow-lg"
          :class="isOwn ? 'right-0' : 'left-0'"
        >
          <button
            v-for="e in REACTIONS"
            :key="e"
            class="text-lg transition hover:scale-125"
            @click="react(e)"
          >
            {{ e }}
          </button>
        </div>

        <div
          v-if="menuOpen"
          class="absolute bottom-8 z-10 w-36 rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg"
          :class="isOwn ? 'right-0' : 'left-0'"
        >
          <button v-if="canTranslate" class="block w-full px-3 py-1.5 text-left hover:bg-slate-50" @click="chat.translate(message.conversationId, message); menuOpen = false">
            {{ message._translation?.showing ? t('chat.showOriginal') : t('chat.translate') }}
          </button>
          <button v-if="isOwn && message.type === 'text'" class="block w-full px-3 py-1.5 text-left hover:bg-slate-50" @click="startEdit">
            {{ t('chat.edit') }}
          </button>
          <button v-if="isOwn" class="block w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50" @click="unsend">
            {{ t('chat.unsend') }}
          </button>
        </div>
      </div>
    </div>

    <!-- reakcje -->
    <div v-if="message.reactions.length" class="mt-0.5 flex gap-1" :class="isOwn ? 'mr-1' : 'ml-1'">
      <button
        v-for="r in message.reactions"
        :key="r.emoji"
        class="flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[11px]"
        :class="r.mine ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'"
        @click="react(r.emoji)"
      >
        <span>{{ r.emoji }}</span>
        <span class="text-slate-500">{{ r.count }}</span>
      </button>
    </div>

    <span v-if="message._translation?.loading" class="ml-1 text-[10px] text-slate-400">
      {{ t('chat.translating') }}
    </span>
  </div>

  <!-- podgląd zdjęcia -->
  <Teleport to="body">
    <div
      v-if="preview"
      class="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-6"
      @click="preview = null"
    >
      <img :src="preview" class="max-h-full max-w-full rounded-lg object-contain" />
    </div>
  </Teleport>
</template>
