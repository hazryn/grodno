/** Formatowanie czasu w czacie: godzina + „ostatnio widziany/temu" (lokalizowane). */
export function useChatTime() {
  const { t, locale } = useI18n();

  function time(iso: string): string {
    return new Date(iso).toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' });
  }

  function relative(iso: string | null): string {
    if (!iso) return '';
    const diffMs = Date.now() - new Date(iso).getTime();
    const min = Math.round(diffMs / 60000);
    if (min < 1) return t('chat.time.now');
    const rtf = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' });
    if (min < 60) return rtf.format(-min, 'minute');
    const h = Math.round(min / 60);
    if (h < 24) return rtf.format(-h, 'hour');
    const d = Math.round(h / 24);
    if (d < 30) return rtf.format(-d, 'day');
    return new Date(iso).toLocaleDateString(locale.value);
  }

  return { time, relative };
}
