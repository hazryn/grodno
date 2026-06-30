import {
  eventCategoryLabel,
  eventTypeLabel,
  formatGedcomDate,
  votoLabel,
  type EventCategory,
  type GedcomDateValue,
  type Locale,
} from '@rodno/shared';

/**
 * Etykiety domenowe (daty, typy/kategorie zdarzeń, voto) związane z aktywnym językiem.
 * Funkcje czytają locale przy wywołaniu → reaktywne w szablonach przy zmianie języka.
 */
export function useDomainLabels() {
  const { locale } = useI18n();
  const loc = (): Locale => locale.value as Locale;
  return {
    formatDate: (v: GedcomDateValue | null | undefined) => formatGedcomDate(v, loc()),
    eventLabel: (tag: string) => eventTypeLabel(tag, loc()),
    eventCategory: (cat: EventCategory) => eventCategoryLabel(cat, loc()),
    voto: (i: number) => votoLabel(i, loc()),
  };
}
