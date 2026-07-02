<script setup lang="ts">
import type { ChatMessage } from '~/composables/useChat';

const props = defineProps<{ conversationId: string; editing: ChatMessage | null }>();
const emit = defineEmits<{ (e: 'cancel-edit'): void }>();

const chat = useChat();
const { t } = useI18n();
const text = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const emojiOpen = ref(false);
const EMOJI = ['🙂', '😂', '❤️', '👍', '🎉', '😢', '🙏', '🔥', '😮', '😍'];
let typingTimer: ReturnType<typeof setTimeout> | null = null;
let typingActive = false;

watch(
  () => props.editing,
  (m) => {
    if (m) text.value = m.body ?? '';
  },
);

function onInput(): void {
  if (props.editing) return;
  if (!typingActive) {
    typingActive = true;
    chat.setTyping(props.conversationId, true);
  }
  if (typingTimer) clearTimeout(typingTimer);
  typingTimer = setTimeout(stopTyping, 2500);
}
function stopTyping(): void {
  if (typingActive) {
    typingActive = false;
    chat.setTyping(props.conversationId, false);
  }
}
async function submit(): Promise<void> {
  const val = text.value.trim();
  if (!val) return;
  if (props.editing) {
    await chat.editMessage(props.conversationId, props.editing.id, val);
    emit('cancel-edit');
  } else {
    stopTyping();
    await chat.sendText(props.conversationId, val);
  }
  text.value = '';
}
function onEnter(e: KeyboardEvent): void {
  if (!e.shiftKey) {
    e.preventDefault();
    void submit();
  }
}
async function onFiles(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  if (files.length) await chat.sendImages(props.conversationId, files);
  if (fileInput.value) fileInput.value.value = '';
}
function addEmoji(em: string): void {
  text.value += em;
  emojiOpen.value = false;
}
onBeforeUnmount(stopTyping);
</script>

<template>
  <div class="border-t border-slate-100 p-2">
    <div
      v-if="editing"
      class="mb-1 flex items-center justify-between rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-700"
    >
      <span>{{ t('chat.edit') }}</span>
      <button @click="emit('cancel-edit')">✕</button>
    </div>
    <div class="flex items-end gap-1">
      <button
        class="rounded-full p-2 text-slate-400 hover:bg-slate-100"
        :title="t('chat.attachImage')"
        @click="fileInput?.click()"
      >
        📎
      </button>
      <input ref="fileInput" type="file" accept="image/*" multiple class="hidden" @change="onFiles" />
      <div class="relative">
        <button
          class="rounded-full p-2 text-slate-400 hover:bg-slate-100"
          @click="emojiOpen = !emojiOpen"
        >
          🙂
        </button>
        <div
          v-if="emojiOpen"
          class="absolute bottom-10 left-0 z-10 grid grid-cols-5 gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
        >
          <button v-for="e in EMOJI" :key="e" class="text-lg hover:scale-125" @click="addEmoji(e)">
            {{ e }}
          </button>
        </div>
      </div>
      <textarea
        v-model="text"
        rows="1"
        :placeholder="t('chat.placeholder')"
        class="max-h-28 flex-1 resize-none rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
        @input="onInput"
        @keydown.enter="onEnter"
      />
      <button
        class="rounded-full bg-amber-500 p-2 text-white transition disabled:opacity-40"
        :disabled="!text.trim()"
        @click="submit"
      >
        ➤
      </button>
    </div>
  </div>
</template>
