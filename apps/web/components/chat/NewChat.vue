<script setup lang="ts">
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const chat = useChat();
const { t } = useI18n();
const { error } = useToast();

const search = ref('');
const selected = ref<string[]>([]);
const groupTitle = ref('');
const busy = ref(false);

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return chat.contacts.value.filter((c) => !q || c.displayName.toLowerCase().includes(q));
});
const isGroup = computed(() => selected.value.length > 1);

watch(
  () => props.open,
  (o) => {
    if (o) {
      void chat.loadContacts();
      selected.value = [];
      groupTitle.value = '';
      search.value = '';
    }
  },
);

function toggle(userId: string): void {
  selected.value = selected.value.includes(userId)
    ? selected.value.filter((id) => id !== userId)
    : [...selected.value, userId];
}

async function create(): Promise<void> {
  if (!selected.value.length || busy.value) return;
  if (isGroup.value && !groupTitle.value.trim()) {
    error(t('chat.groupNameRequired'));
    return;
  }
  busy.value = true;
  try {
    if (isGroup.value) await chat.createGroup(groupTitle.value.trim(), selected.value);
    else await chat.openDirect(selected.value[0]);
    emit('close');
  } catch {
    error(t('chat.createError'));
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <CommonModal :open="open" :title="t('chat.newChat')" max-width="max-w-md" @close="emit('close')">
    <div class="space-y-3 p-4">
      <input
        v-model="search"
        :placeholder="t('chat.searchContacts')"
        class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
      />
      <input
        v-if="isGroup"
        v-model="groupTitle"
        :placeholder="t('chat.groupName')"
        class="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
      />
      <div class="max-h-64 space-y-1 overflow-y-auto">
        <p v-if="!filtered.length" class="py-4 text-center text-sm text-slate-400">
          {{ t('search.noResults') }}
        </p>
        <button
          v-for="c in filtered"
          :key="c.userId"
          class="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50"
          :class="selected.includes(c.userId) ? 'bg-amber-50' : ''"
          @click="toggle(c.userId)"
        >
          <ChatAvatar
            :photo-url="c.photoUrl"
            :name="c.displayName"
            :sex="c.sex"
            :online="chat.isOnline(c.userId)"
            show-presence
            size="sm"
          />
          <span class="flex-1 truncate text-sm text-slate-700">{{ c.displayName }}</span>
          <span
            v-if="selected.includes(c.userId)"
            class="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[11px] text-white"
          >
            ✓
          </span>
        </button>
      </div>
    </div>
    <template #footer>
      <div class="flex justify-end gap-2">
        <button class="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100" @click="emit('close')">
          {{ t('common.cancel') }}
        </button>
        <button
          class="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          :disabled="!selected.length || busy"
          @click="create"
        >
          {{ isGroup ? t('chat.newGroup') : t('chat.startChat') }}
        </button>
      </div>
    </template>
  </CommonModal>
</template>
