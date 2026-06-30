<script setup lang="ts">
import { votoLabel, type IndividualDto, type PersonName, type Sex } from '@rodno/shared';

/** Edycja danych osoby. `section` wybiera zakres pól (taby w panelu). Tag: <PersonEditForm>. */
const props = withDefaults(
  defineProps<{ person: IndividualDto; section?: 'basic' | 'contact' }>(),
  { section: 'basic' },
);
const emit = defineEmits<{ (e: 'saved', person: IndividualDto): void }>();

const api = useApi();
const { success, error } = useToast();

const primary = props.person.names[0] ?? { type: 'birth', given: '', surname: '', full: '' };
const given = ref(primary.given ?? '');
const surname = ref(primary.surname ?? '');
// Nazwiska po ślubie (primo/secundo voto) — „generalnie 2".
const marriedSurnames = ref<string[]>(
  props.person.names.filter((n) => n.type === 'married' && (n.surname ?? '').trim()).map((n) => n.surname as string),
);
const sex = ref<Sex>(props.person.sex);
const bio = ref(props.person.bio ?? '');
const facebookUrl = ref(props.person.facebookUrl ?? '');
const linkedinUrl = ref(props.person.linkedinUrl ?? '');
const xUrl = ref(props.person.xUrl ?? '');
const instagramUrl = ref(props.person.instagramUrl ?? '');
const emails = ref<string[]>([...props.person.emails]);
const saving = ref(false);

const SEXES: Array<{ value: Sex; label: string }> = [
  { value: 'M', label: 'Mężczyzna' },
  { value: 'F', label: 'Kobieta' },
  { value: 'U', label: 'Nieznana' },
];

function addEmail() {
  emails.value = [...emails.value, ''];
}
function removeEmail(i: number) {
  emails.value = emails.value.filter((_, idx) => idx !== i);
}
function addMarried() {
  if (marriedSurnames.value.length < 4) marriedSurnames.value = [...marriedSurnames.value, ''];
}
function removeMarried(i: number) {
  marriedSurnames.value = marriedSurnames.value.filter((_, idx) => idx !== i);
}

async function save() {
  saving.value = true;
  try {
    let patch;
    if (props.section === 'basic') {
      const g = given.value.trim();
      const full = `${g} ${surname.value}`.trim();
      const names: PersonName[] = [
        { type: primary.type || 'birth', given: g || null, surname: surname.value.trim() || null, full: full || '…' },
      ];
      // zachowaj inne warianty (np. aka), poza „po ślubie" (przebudowywane niżej)
      for (const n of props.person.names.slice(1)) {
        if (n.type !== 'married' && n.type !== 'maiden') names.push(n);
      }
      for (const ms of marriedSurnames.value) {
        const s = ms.trim();
        if (s) names.push({ type: 'married', given: g || null, surname: s, full: `${g} ${s}`.trim() });
      }
      patch = { names, sex: sex.value, bio: bio.value.trim() || null };
    } else {
      patch = {
        facebookUrl: facebookUrl.value.trim() || null,
        linkedinUrl: linkedinUrl.value.trim() || null,
        xUrl: xUrl.value.trim() || null,
        instagramUrl: instagramUrl.value.trim() || null,
        emails: emails.value.map((e) => e.trim()).filter(Boolean),
      };
    }
    const updated = await api.updateIndividual(props.person.id, patch);
    success('Zapisano dane osoby.');
    emit('saved', updated);
  } catch {
    error('Nie udało się zapisać.');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="save">
    <template v-if="section === 'basic'">
      <div class="grid grid-cols-2 gap-3">
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-500">Imię</span>
          <input v-model="given" type="text" class="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-500">Nazwisko</span>
          <input v-model="surname" type="text" class="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
        </label>
      </div>

      <div>
        <span class="mb-1 block text-xs font-medium text-slate-500">Nazwiska po ślubie</span>
        <div class="space-y-2">
          <div v-for="(_, i) in marriedSurnames" :key="i" class="flex items-center gap-2">
            <span v-if="marriedSurnames.length > 1" class="w-28 shrink-0 text-right text-xs text-slate-400">{{ votoLabel(i) }}</span>
            <input v-model="marriedSurnames[i]" type="text" placeholder="nazwisko" class="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
            <button type="button" class="rounded-lg px-2 text-slate-400 hover:bg-slate-100" @click="removeMarried(i)">✕</button>
          </div>
          <button v-if="marriedSurnames.length < 4" type="button" class="text-xs font-medium text-sky-600 hover:underline" @click="addMarried">
            + dodaj nazwisko po ślubie
          </button>
        </div>
      </div>

      <div>
        <span class="mb-1 block text-xs font-medium text-slate-500">Płeć</span>
        <div class="flex gap-2">
          <button
            v-for="s in SEXES"
            :key="s.value"
            type="button"
            class="rounded-lg border px-3 py-1.5 text-sm transition"
            :class="sex === s.value ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'"
            @click="sex = s.value"
          >
            {{ s.label }}
          </button>
        </div>
      </div>

      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-500">Nota biograficzna</span>
        <textarea v-model="bio" rows="5" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </label>
    </template>

    <template v-else>
      <div class="space-y-2">
        <span class="block text-xs font-medium text-slate-500">Profile społecznościowe</span>
        <input v-model="facebookUrl" type="url" placeholder="Facebook URL" class="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
        <input v-model="linkedinUrl" type="url" placeholder="LinkedIn URL" class="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
        <input v-model="instagramUrl" type="url" placeholder="Instagram URL" class="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
        <input v-model="xUrl" type="url" placeholder="X (Twitter) URL" class="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
      </div>

      <div class="space-y-2">
        <span class="block text-xs font-medium text-slate-500">E-maile</span>
        <div v-for="(_, i) in emails" :key="i" class="flex gap-2">
          <input v-model="emails[i]" type="email" placeholder="adres@e-mail" class="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm" />
          <button type="button" class="rounded-lg px-2 text-slate-400 hover:bg-slate-100" @click="removeEmail(i)">✕</button>
        </div>
        <button type="button" class="text-xs font-medium text-sky-600 hover:underline" @click="addEmail">+ dodaj e-mail</button>
      </div>
    </template>

    <div class="flex justify-end">
      <button
        type="submit"
        :disabled="saving"
        class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
      >
        {{ saving ? 'Zapisywanie…' : 'Zapisz' }}
      </button>
    </div>
  </form>
</template>
