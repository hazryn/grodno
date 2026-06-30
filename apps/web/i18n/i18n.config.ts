/**
 * Konfiguracja vue-i18n (Composition API). Wiadomości ładowane leniwie z locales/*.json.
 * Polski ma 3 formy liczby mnogiej: 1 (one), 2–4 (few, poza 12–14), reszta (many).
 */
export default defineI18nConfig(() => ({
  legacy: false,
  pluralRules: {
    pl: (choice: number, choicesLength: number): number => {
      if (choice === 0 && choicesLength > 3) return 0;
      if (choice === 1) return choicesLength > 3 ? 1 : 0;
      const mod10 = choice % 10;
      const mod100 = choice % 100;
      const few = mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14);
      if (choicesLength > 3) return few ? 2 : 3;
      return few ? 1 : 2;
    },
  },
}));
