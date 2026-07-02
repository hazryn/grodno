<script setup lang="ts">
const props = defineProps<{ open: boolean; conversationId: string }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const chat = useChat();
const api = useApi();
const { t } = useI18n();
const { ask } = useConfirm();
const { error } = useToast();

const conv = computed(() => chat.conversationById(props.conversationId));
const meId = chat.meId;
const isAdmin = computed(
  () => conv.value?.participants.find((p) => p.userId === meId.value)?.role === 'admin',
);
const title = ref('');
const adding = ref(false);
const search = ref('');

watch(
  () => props.open,
  (o) => {
    if (o) {
      title.value = conv.value?.title ?? '';
      adding.value = false;
      search.value = '';
      void chat.loadContacts();
    }
  },
);

const memberIds = computed(() => new Set(conv.value?.participants.map((p) => p.userId) ?? []));
const addable = computed(() => {
  const q = search.value.trim().toLowerCase();
  return chat.contacts.value.filter(
    (c) => !memberIds.value.has(c.userId) && (!q || c.displayName.toLowerCase().includes(q)),
  );
});

async function rename(): Promise<void> {
  const val = title.value.trim();
  if (!val || val === conv.value?.title) return;
  try {
    await api.renameGroup(props.conversationId, val);
    await chat.refreshConversation(props.conversationId);
  } catch {
    error(t('chat.createError'));
  }
}
async function addMember(userId: string): Promise<void> {
  try {
    await api.addParticipants(props.conversationId, [userId]);
    await chat.refreshConversation(props.conversationId);
  } catch {
    error(t('chat.createError'));
  }
}
async function removeMember(userId: string): Promise<void> {
  try {
    await api.removeParticipant(props.conversationId, userId);
    await chat.refreshConversation(props.conversationId);
  } catch {
    error(t('chat.createError'));
  }
}
async function leave(): Promise<void> {
  if (!(await ask({ title: t('chat.leaveGroup'), confirmLabel: t('chat.leaveGroup'), danger: true }))) return;
  try {
    if (meId.value) await api.removeParticipant(props.conversationId, meId.value);
    chat.closeWindow(props.conversationId);
    chat.conversations.value = chat.conversations.value.filter((c) => c.id !== props.conversationId);
    emit('close');
  } catch {
    error(t('chat.createError'));
  }
}
</script>

<template>
  <CommonModal :open="open" :title="t('chat.groupSettings')" max-width="max-w-md" @close="emit('close')">
    <div v-if="conv" class="space-y-4 p-4">
      <div>
        <label class="mb-1 block text-xs font-medium text-slate-500">{{ t('chat.groupName') }}</label>
        <div class="flex gap-2">
          <input
            v-model="title"
            :disabled="!isAdmin"
            class="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none disabled:bg-slate-50"
          />
          <button
            v-if="isAdmin"
            class="rounded-lg bg-amber-500 px-3 py-1.5 text-sm text-white"
            @click="rename"
          >
            {{ t('common.save') }}
          </button>
        </div>
      </div>

      <div>
        <div class="mb-1 flex items-center justify-between">
          <span class="text-xs font-medium text-slate-500">
            {{ t('common.peopleCount', conv.participants.length, { n: conv.participants.length }) }}
          </span>
          <button
            v-if="isAdmin"
            class="text-xs text-amber-600 hover:underline"
            @click="adding = !adding"
          >
            {{ t('chat.addMembers') }}
          </button>
        </div>

        <div class="space-y-1">
          <div
            v-for="p in conv.participants"
            :key="p.userId"
            class="flex items-center gap-2 rounded-lg px-1 py-1"
          >
            <ChatAvatar :photo-url="p.photoUrl" :name="p.displayName" :sex="p.sex" :online="chat.isOnline(p.userId)" show-presence size="sm" />
            <span class="flex-1 truncate text-sm text-slate-700">{{ p.displayName }}</span>
            <span v-if="p.role === 'admin'" class="text-[10px] uppercase text-amber-500">admin</span>
            <button
              v-if="isAdmin && p.userId !== meId"
              class="text-slate-300 hover:text-red-500"
              @click="removeMember(p.userId)"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      <div v-if="adding && isAdmin" class="rounded-lg border border-slate-100 p-2">
        <input
          v-model="search"
          :placeholder="t('chat.searchContacts')"
          class="mb-2 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none"
        />
        <div class="max-h-40 space-y-1 overflow-y-auto">
          <button
            v-for="c in addable"
            :key="c.userId"
            class="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-slate-50"
            @click="addMember(c.userId)"
          >
            <ChatAvatar :photo-url="c.photoUrl" :name="c.displayName" :sex="c.sex" size="sm" />
            <span class="flex-1 truncate text-sm text-slate-700">{{ c.displayName }}</span>
            <span class="text-amber-500">+</span>
          </button>
        </div>
      </div>

      <button class="text-sm text-red-600 hover:underline" @click="leave">{{ t('chat.leaveGroup') }}</button>
    </div>
  </CommonModal>
</template>
