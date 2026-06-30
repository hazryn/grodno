<script setup lang="ts">
definePageMeta({ middleware: 'guest' });

const config = useRuntimeConfig();
const appTitle = config.public.appTitle as string;
const familyName = config.public.familyName as string;
const tagline = config.public.tagline as string;
const description = config.public.description as string;

const heading = familyName ? `Drzewo rodziny ${familyName}` : tagline;

interface Feature {
  icon: string;
  title: string;
  desc: string;
}

const features: Feature[] = [
  {
    icon: '🌳',
    title: 'Interaktywne drzewo',
    desc: 'Przeglądaj pokolenia w górę i w dół, rozwijaj gałęzie i centruj widok na dowolnej osobie.',
  },
  {
    icon: '📸',
    title: 'Galerie zdjęć',
    desc: 'Albumy przy każdej osobie i parze, oznaczanie twarzy na zdjęciach, fotografie ślubne.',
  },
  {
    icon: '🕰️',
    title: 'Oś czasu życia',
    desc: 'Narodziny, śluby, miejsca, praca i ważne wydarzenia — cała historia w jednym miejscu.',
  },
  {
    icon: '👤',
    title: 'Bogate profile',
    desc: 'Biografie, nazwiska panieńskie, linki, dokumenty i wspomnienia o bliskich.',
  },
  {
    icon: '💬',
    title: 'Czat i wspomnienia',
    desc: 'Rozmawiajcie, komentujcie zdjęcia i spisujcie rodzinne historie wspólnie.',
  },
  {
    icon: '🎂',
    title: 'Przypomnienia',
    desc: 'Urodziny, imieniny i rocznice ślubu — nigdy nie przegapisz ważnej daty.',
  },
  {
    icon: '🗺️',
    title: 'Mapa rodziny',
    desc: 'Zobacz, skąd pochodzą Twoi przodkowie i jak rodzina wędrowała przez pokolenia.',
  },
  {
    icon: '✍️',
    title: 'Wspólne tworzenie',
    desc: 'Każdy dokłada cegiełkę: zdjęcia, daty, historie. Drzewo rośnie razem z całą rodziną.',
  },
];

// Top 20 nazwisk — pobierane w SSR (useAsyncData renderuje serwerowo, bez migotania).
const api = useApi();
const { data: surnames } = await useAsyncData('top-surnames', () =>
  api.topSurnames(config.public.treeName as string).catch(() => [] as Array<{ surname: string; count: number }>),
);
const maxCount = computed(() => surnames.value?.[0]?.count ?? 1);
function sizeFor(count: number): string {
  return `${(0.9 + (count / maxCount.value) * 1.5).toFixed(2)}rem`;
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-amber-50 via-white to-slate-50">
    <header class="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
      <span class="text-lg font-bold tracking-tight text-amber-500">{{ appTitle }}</span>
      <NuxtLink
        to="/login"
        class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
      >
        Zaloguj się
      </NuxtLink>
    </header>

    <!-- HERO: tekst 2/3, formularz 1/3 -->
    <section class="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-12 md:grid-cols-3 md:py-20">
      <div class="md:col-span-2">
        <span class="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
          Rodzinne drzewo genealogiczne
        </span>
        <h1 class="mt-4 text-4xl font-bold leading-tight tracking-tight text-slate-800 sm:text-5xl">
          {{ heading }}
        </h1>
        <p class="mt-4 max-w-md text-lg leading-relaxed text-slate-500">
          {{ description }}
        </p>
        <p class="mt-3 max-w-md text-base leading-relaxed text-slate-500">
          Wspólne, żywe miejsce, w którym poznajecie swoich przodków, dzielicie się zdjęciami
          i wspomnieniami — i pielęgnujecie pamięć o rodzinie z pokolenia na pokolenie.
        </p>
        <div class="mt-8 flex flex-wrap items-center gap-3">
          <a
            href="#dostep"
            class="rounded-lg bg-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600"
          >
            Poproś o dostęp
          </a>
          <NuxtLink
            to="/login"
            class="rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            Mam już konto
          </NuxtLink>
        </div>
        <p class="mt-4 text-sm text-slate-400">🔒 Dostęp tylko dla rodziny — po potwierdzeniu adresu e-mail.</p>
      </div>

      <div id="dostep" class="scroll-mt-8">
        <AccessRequestForm />
        <p class="mt-4 text-center text-sm text-slate-400">
          Masz już dostęp?
          <NuxtLink to="/login" class="font-medium text-amber-600 hover:text-amber-700">Zaloguj się</NuxtLink>
        </p>
      </div>
    </section>

    <!-- NAZWISKA (chmura, pobierana w SSR) -->
    <section v-if="surnames?.length" class="mx-auto w-full max-w-6xl px-6 pb-12">
      <div class="rounded-3xl border border-slate-200 bg-white/70 px-8 py-10 text-center shadow-sm backdrop-blur">
        <h2 class="text-xl font-bold tracking-tight text-slate-800 sm:text-2xl">Nazwiska w rodzinie</h2>
        <p class="mt-1 text-sm text-slate-500">20 najczęściej występujących nazwisk w drzewie.</p>
        <div class="mt-6 flex flex-wrap items-baseline justify-center gap-x-5 gap-y-2">
          <span
            v-for="s in surnames"
            :key="s.surname"
            :style="{ fontSize: sizeFor(s.count) }"
            :title="`${s.count} osób`"
            class="font-semibold leading-tight text-slate-700 transition hover:text-amber-600"
          >
            {{ s.surname }}<span class="ml-0.5 align-super text-[10px] font-normal text-slate-400">{{ s.count }}</span>
          </span>
        </div>
      </div>
    </section>

    <!-- FUNKCJE -->
    <section class="mx-auto w-full max-w-6xl px-6 pb-20">
      <div class="mb-10 text-center">
        <h2 class="text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">Co znajdziesz w środku</h2>
        <p class="mt-2 text-slate-500">Wszystko, czego potrzeba, by historia rodziny żyła i rosła.</p>
      </div>
      <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="f in features"
          :key="f.title"
          class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-2xl">
            {{ f.icon }}
          </div>
          <h3 class="mt-4 text-base font-semibold text-slate-800">{{ f.title }}</h3>
          <p class="mt-1.5 text-sm leading-relaxed text-slate-500">{{ f.desc }}</p>
        </div>
      </div>

      <!-- domknięcie -->
      <div class="mt-14 rounded-3xl bg-gradient-to-br from-amber-500 to-amber-600 px-8 py-12 text-center text-white shadow-sm">
        <h2 class="text-2xl font-bold tracking-tight sm:text-3xl">Twórzmy je razem</h2>
        <p class="mx-auto mt-3 max-w-xl text-amber-50">
          Im więcej rąk, tym pełniejsze drzewo. Dodaj zdjęcia, uzupełnij daty, opowiedz historię —
          a inni wrócą, by zobaczyć, co nowego u rodziny.
        </p>
        <a
          href="#dostep"
          class="mt-6 inline-block rounded-lg bg-white px-6 py-3 text-sm font-semibold text-amber-600 shadow-sm transition hover:bg-amber-50"
        >
          Dołącz do drzewa
        </a>
      </div>
    </section>
  </div>
</template>
