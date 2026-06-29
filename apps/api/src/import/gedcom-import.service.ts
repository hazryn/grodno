import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';
import {
  parseGedcomDate,
  gedcomDateSortKey,
  gedcomDateYear,
  normalizeSex,
  type GedcomDateValue,
  type PersonName,
  type WorkExperience,
} from '@rodno/shared';
import {
  Event,
  Family,
  FamilyChild,
  Individual,
  Media,
  Place,
  Source,
  Tree,
} from '../database/entities';
import {
  asPointer,
  childValue,
  childrenWithTag,
  firstChild,
  parseGedcom,
  type GedcomNode,
} from './gedcom-parser';

export interface ImportStats {
  treeId: string;
  individuals: number;
  families: number;
  familyChildren: number;
  events: number;
  places: number;
  sources: number;
  media: number;
}

/** Tagi pod INDI, które NIE są zdarzeniami (mają własną obsługę albo są strukturalne). */
const NON_EVENT_INDI = new Set([
  'NAME', 'SEX', 'FAMC', 'FAMS', 'OBJE', 'NOTE', 'SOUR', 'RIN', 'RFN', 'AFN',
  'REFN', 'CHAN', 'SUBM', 'ANCI', 'DESI', 'ASSO', 'ALIA',
  // Obsłużone osobno: kontakt/social + doświadczenie (sekcja „Praca", nie oś czasu).
  'EMAIL', 'EMAI', 'OCCU',
]);

/** Tagi pod FAM, które NIE są zdarzeniami rodziny. */
const NON_EVENT_FAM = new Set([
  'HUSB', 'WIFE', 'CHIL', 'NOTE', 'SOUR', 'OBJE', 'RIN', 'REFN', 'CHAN', 'SUBM',
]);

interface BuildContext {
  treeId: string;
  places: Place[];
  placesByName: Map<string, Place>;
  individuals: Map<string, Individual>; // xref → entity
  families: Map<string, Family>;
  sources: Map<string, Source>;
  media: Map<string, Media>;
  events: Event[];
  familyChildren: FamilyChild[];
  /** xref dziecka → xref rodziny rodzicielskiej (pierwsza FAMC). */
  childFamilyOf: Map<string, string>;
}

@Injectable()
export class GedcomImportService {
  private readonly logger = new Logger(GedcomImportService.name);

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async importFromFile(treeName: string, filePath: string): Promise<ImportStats> {
    const text = await readFile(filePath, 'utf8');
    return this.importFromText(treeName, text);
  }

  async importFromText(treeName: string, text: string): Promise<ImportStats> {
    const roots = parseGedcom(text);
    this.logger.log(`Sparsowano ${roots.length} rekordów 0-poziomu z GEDCOM`);

    const treeId = randomUUID();
    const ctx: BuildContext = {
      treeId,
      places: [],
      placesByName: new Map(),
      individuals: new Map(),
      families: new Map(),
      sources: new Map(),
      media: new Map(),
      events: [],
      familyChildren: [],
      childFamilyOf: new Map(),
    };

    // Pass 1 — źródła i media (potrzebne do pointerów OBJE/SOUR w osobach).
    for (const rec of roots) {
      if (rec.tag === 'SOUR' && rec.xref) this.buildSource(rec, ctx);
      else if (rec.tag === 'OBJE' && rec.xref) this.buildMedia(rec, ctx);
    }

    // Pass 2 — osoby.
    for (const rec of roots) {
      if (rec.tag === 'INDI' && rec.xref) this.buildIndividual(rec, ctx);
    }

    // Pass 3 — rodziny (rozwiązują pointery osób).
    for (const rec of roots) {
      if (rec.tag === 'FAM' && rec.xref) this.buildFamily(rec, ctx);
    }

    // Pass 4 — flagi grafu (hasParents / childCount).
    this.computeGraphFlags(ctx);

    // Zapis w transakcji (z wyczyszczeniem poprzedniego drzewa o tej nazwie).
    await this.ds.transaction(async (m) => {
      await this.wipeTree(m, treeName);
      const tree = m.create(Tree, { id: treeId, name: treeName, title: treeName });
      await m.save(tree);
      await this.saveChunked(m, Place, ctx.places);
      await this.saveChunked(m, Source, [...ctx.sources.values()]);
      await this.saveChunked(m, Media, [...ctx.media.values()]);
      await this.saveChunked(m, Individual, [...ctx.individuals.values()]);
      await this.saveChunked(m, Family, [...ctx.families.values()]);
      await this.saveChunked(m, FamilyChild, ctx.familyChildren);
      await this.saveChunked(m, Event, ctx.events);
    });

    const stats: ImportStats = {
      treeId,
      individuals: ctx.individuals.size,
      families: ctx.families.size,
      familyChildren: ctx.familyChildren.length,
      events: ctx.events.length,
      places: ctx.places.length,
      sources: ctx.sources.size,
      media: ctx.media.size,
    };
    this.logger.log(`Import zakończony: ${JSON.stringify(stats)}`);
    return stats;
  }

  /* ------------------------------- budowniczowie ------------------------------- */

  private buildSource(rec: GedcomNode, ctx: BuildContext): void {
    const s = new Source();
    s.id = randomUUID();
    s.treeId = ctx.treeId;
    s.xref = rec.xref!;
    s.title = childValue(rec, 'TITL') ?? childValue(rec, 'ABBR') ?? null;
    s.author = childValue(rec, 'AUTH') ?? null;
    s.text = childValue(rec, 'TEXT') ?? null;
    ctx.sources.set(s.xref, s);
  }

  private buildMedia(rec: GedcomNode, ctx: BuildContext): void {
    const m = new Media();
    m.id = randomUUID();
    m.treeId = ctx.treeId;
    m.xref = rec.xref!;
    const fileNode = firstChild(rec, 'FILE');
    m.filename = fileNode?.value ?? null;
    m.title =
      childValue(rec, 'TITL') ??
      (fileNode ? childValue(fileNode, 'TITL') : undefined) ??
      null;
    m.format =
      (fileNode ? childValue(fileNode, 'FORM') : undefined) ??
      childValue(rec, 'FORM') ??
      null;
    ctx.media.set(m.xref, m);
  }

  private buildIndividual(rec: GedcomNode, ctx: BuildContext): void {
    const indi = new Individual();
    indi.id = randomUUID();
    indi.treeId = ctx.treeId;
    indi.xref = rec.xref!;
    indi.sex = normalizeSex(childValue(rec, 'SEX'));

    // Imiona.
    const names: PersonName[] = childrenWithTag(rec, 'NAME').map((n, i) =>
      this.parseName(n, i === 0),
    );
    indi.names = names;
    indi.primaryName = names[0]?.full ?? '…';

    // Foto — pierwszy pointer OBJE → media (URL do MinIO).
    indi.photoUrl = null;
    for (const obje of childrenWithTag(rec, 'OBJE')) {
      const ptr = asPointer(obje.value);
      const media = ptr ? ctx.media.get(ptr) : undefined;
      if (media) {
        indi.photoMediaId = media.id;
        indi.photoUrl = this.mediaUrl(media.filename);
        break;
      }
    }

    // Zdarzenia.
    let hasDeathTag = false;
    for (const child of rec.children) {
      if (NON_EVENT_INDI.has(child.tag) || child.tag.startsWith('_')) continue;
      const ev = this.buildEvent(child, ctx, 'individual');
      ev.individualId = indi.id;
      ctx.events.push(ev);

      if (child.tag === 'BIRT') {
        indi.birthDate = ev.date;
        indi.birthYear = gedcomDateYear(ev.date);
        indi.birthPlaceId = ev.placeId;
        indi.birthPlaceFull = ev.placeName;
        indi.birthPlaceTown = ev.placeId
          ? ctx.places.find((p) => p.id === ev.placeId)?.town ?? null
          : null;
      } else if (child.tag === 'DEAT') {
        hasDeathTag = true;
        indi.deathDate = ev.date;
        indi.deathYear = gedcomDateYear(ev.date);
        indi.deathPlaceId = ev.placeId;
      }
    }

    indi.deceased = this.guessDeceased(indi.birthYear, hasDeathTag);
    indi.lifespan = this.buildLifespan(indi.birthYear, indi.deathYear, indi.deceased, indi.sex);
    indi.isLiving = this.guessLiving(indi.birthYear, hasDeathTag);
    indi.hasParents = false;
    indi.childCount = 0;

    // Kontakt / social + doświadczenie zawodowe (styl LinkedIn).
    indi.emails = this.collectEmails(rec);
    indi.linkedinUrl = childValue(rec, '_LINKEDIN') ?? childValue(rec, '_LNKD') ?? null;
    indi.xUrl = childValue(rec, '_X') ?? childValue(rec, '_TWITTER') ?? null;
    indi.experience = this.buildExperience(rec);

    // FAMC — zapamiętaj pierwszą rodzinę rodzicielską.
    const famc = childrenWithTag(rec, 'FAMC')
      .map((n) => asPointer(n.value))
      .find((p): p is string => p !== null);
    if (famc) ctx.childFamilyOf.set(indi.xref, famc);

    ctx.individuals.set(indi.xref, indi);
  }

  private buildFamily(rec: GedcomNode, ctx: BuildContext): void {
    const fam = new Family();
    fam.id = randomUUID();
    fam.treeId = ctx.treeId;
    fam.xref = rec.xref!;

    const husbXref = asPointer(childValue(rec, 'HUSB'));
    const wifeXref = asPointer(childValue(rec, 'WIFE'));
    fam.husbandId = husbXref ? ctx.individuals.get(husbXref)?.id ?? null : null;
    fam.wifeId = wifeXref ? ctx.individuals.get(wifeXref)?.id ?? null : null;
    ctx.families.set(fam.xref, fam);

    // Dzieci.
    let order = 0;
    for (const chil of childrenWithTag(rec, 'CHIL')) {
      const childXref = asPointer(chil.value);
      const child = childXref ? ctx.individuals.get(childXref) : undefined;
      if (!child) continue;
      const fc = new FamilyChild();
      fc.treeId = ctx.treeId;
      fc.familyId = fam.id;
      fc.childId = child.id;
      fc.sortOrder = order++;
      fc.pedigree = 'birth';
      ctx.familyChildren.push(fc);
    }

    // Zdarzenia rodziny (MARR, DIV, ...).
    for (const child of rec.children) {
      if (NON_EVENT_FAM.has(child.tag) || child.tag.startsWith('_')) continue;
      const ev = this.buildEvent(child, ctx, 'family');
      ev.familyId = fam.id;
      ctx.events.push(ev);
    }
  }

  private buildEvent(
    node: GedcomNode,
    ctx: BuildContext,
    ownerType: 'individual' | 'family',
  ): Event {
    const ev = new Event();
    ev.treeId = ctx.treeId;
    ev.ownerType = ownerType;
    ev.type = node.tag;

    const dateRaw = childValue(node, 'DATE');
    const date: GedcomDateValue | null = parseGedcomDate(dateRaw);
    ev.date = date;
    ev.sortKey = gedcomDateSortKey(date);

    const placeName = childValue(node, 'PLAC');
    if (placeName && placeName.trim()) {
      const place = this.getOrCreatePlace(placeName, ctx);
      ev.placeId = place?.id ?? null;
      ev.placeName = place?.name ?? placeName.trim();
    } else {
      ev.placeId = null;
      ev.placeName = null;
    }

    // Wartość zdarzenia (np. zawód przy OCCU) — pomiń "Y" (znacznik zaistnienia).
    const v = node.value?.trim();
    ev.value = v && v !== 'Y' ? v : null;
    return ev;
  }

  /* --------------------------------- helpery --------------------------------- */

  private parseName(nameNode: GedcomNode, isPrimary: boolean): PersonName {
    const raw = nameNode.value ?? '';
    const typeTag = childValue(nameNode, 'TYPE');
    let given = childValue(nameNode, 'GIVN') ?? null;
    let surname = childValue(nameNode, 'SURN') ?? null;

    const slash = /\/([^/]*)\//.exec(raw);
    if (surname === null && slash) surname = slash[1].trim() || null;
    if (given === null) {
      const before = raw.split('/')[0]?.trim() ?? '';
      given = before || null;
    }

    // Nieznane imię/nazwisko → wielokropek (np. „Rozalia …", „… Szejna", „…").
    const givenDisp = given?.trim() || '…';
    const surnameDisp = surname?.trim() || '…';
    const full = given || surname ? `${givenDisp} ${surnameDisp}` : '…';

    return {
      type: typeTag ?? (isPrimary ? 'birth' : 'aka'),
      given,
      surname,
      full,
    };
  }

  /**
   * Normalizuje napis PLAC do encji gazetteer i zwraca liść (najbardziej szczegółowe miejsce).
   * "Warszawa, Mazowieckie, Polska" → tworzy Polska ⊃ Mazowieckie ⊃ Warszawa.
   */
  private getOrCreatePlace(name: string, ctx: BuildContext): Place | undefined {
    const segments = name.split(',').map((s) => s.trim()).filter(Boolean);
    if (segments.length === 0) return undefined;

    let prevId: string | null = null;
    let leaf: Place | undefined;
    for (let i = segments.length - 1; i >= 0; i--) {
      const subName = segments.slice(i).join(', ');
      let place = ctx.placesByName.get(subName);
      if (!place) {
        place = new Place();
        place.id = randomUUID();
        place.treeId = ctx.treeId;
        place.name = subName;
        place.town = segments[i] ?? null;
        // Liść (i=0) = miasto, korzeń (ostatni) = kraj, środek = region.
        // Jednoczłonowa nazwa jest niejednoznaczna (kraj? miasto?) → 'unknown'.
        place.type =
          segments.length === 1
            ? null
            : i === 0
              ? 'city'
              : i === segments.length - 1
                ? 'country'
                : 'region';
        place.parentId = prevId;
        place.lat = null;
        place.lng = null;
        place.countryCode = null;
        place.gazetteerSource = null;
        place.gazetteerId = null;
        ctx.placesByName.set(subName, place);
        ctx.places.push(place);
      }
      prevId = place.id;
      leaf = place;
    }
    return leaf;
  }

  /** Publiczny URL pliku mediów w MinIO (klucz = basename pliku z GEDCOM). */
  private mediaUrl(filename: string | null): string | null {
    if (!filename) return null;
    const base = process.env.MEDIA_PUBLIC_BASE ?? 'http://localhost:5203/rodno-media';
    const key = filename.split('/').pop() ?? filename;
    return `${base}/${encodeURIComponent(key)}`;
  }

  /**
   * Wszystkie e-maile osoby (bez duplikatów). Skanuje całe poddrzewo INDI, bo
   * webtrees zagnieżdża EMAIL pod RESI (`1 RESI` › `2 EMAIL ...`), nie tylko wprost pod INDI.
   */
  private collectEmails(rec: GedcomNode): string[] {
    const out: string[] = [];
    const isEmail = (t: string) => t === 'EMAIL' || t === '_EMAIL' || t === 'EMAI';
    const walk = (node: GedcomNode): void => {
      for (const c of node.children) {
        if (isEmail(c.tag)) {
          const v = c.value?.trim();
          if (v && !out.includes(v)) out.push(v);
        }
        if (c.children.length) walk(c);
      }
    };
    walk(rec);
    return out;
  }

  /** Doświadczenie zawodowe ze zdarzeń OCCU (stanowisko + firma AGNC + okres + logo z _DOMAIN). */
  private buildExperience(rec: GedcomNode): WorkExperience[] {
    return childrenWithTag(rec, 'OCCU').map((occu) => {
      const title = occu.value?.trim() || 'Praca';
      const company = childValue(occu, 'AGNC') ?? childValue(occu, 'CORP') ?? null;
      const { from, to } = this.parsePeriod(childValue(occu, 'DATE'));
      const domain = childValue(occu, '_DOMAIN') ?? childValue(occu, '_LOGO') ?? null;
      const logoUrl = domain
        ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain.trim())}&sz=64`
        : null;
      return { title, company, from, to, logoUrl };
    });
  }

  /** Rozbija GEDCOM DATE okresu na rok-od / rok-do (null „do” = trwa obecnie). */
  private parsePeriod(raw: string | null | undefined): { from: string | null; to: string | null } {
    if (!raw) return { from: null, to: null };
    const s = raw.trim();
    let m = /^FROM\s+(.+?)\s+TO\s+(.+)$/i.exec(s);
    if (m) return { from: this.yearOf(m[1]), to: this.yearOf(m[2]) };
    m = /^FROM\s+(.+)$/i.exec(s);
    if (m) return { from: this.yearOf(m[1]), to: null };
    m = /^TO\s+(.+)$/i.exec(s);
    if (m) return { from: null, to: this.yearOf(m[1]) };
    m = /^(?:BET\s+)?(.+?)\s+AND\s+(.+)$/i.exec(s);
    if (m) return { from: this.yearOf(m[1]), to: this.yearOf(m[2]) };
    const y = this.yearOf(s);
    return { from: y, to: y };
  }

  private yearOf(s: string): string {
    const y = gedcomDateYear(parseGedcomDate(s.trim()));
    return y != null ? String(y) : s.trim();
  }

  private guessDeceased(birthYear: number | null | undefined, hasDeathTag: boolean): boolean {
    if (hasDeathTag) return true;
    const b = birthYear ?? null;
    // Brak DEAT, ale bardzo dawne urodzenie → na pewno nie żyje. „Nieznany" (brak roku) ≠ zmarły.
    return b !== null && new Date().getFullYear() - b > 120;
  }

  private buildLifespan(
    birth: number | null | undefined,
    death: number | null | undefined,
    isDeceased: boolean,
    sex: string,
  ): string | null {
    const b = birth ?? null;
    const d = death ?? null;
    const word = sex === 'F' ? 'zmarła' : sex === 'M' ? 'zmarły' : 'zmarły/a';
    if (b !== null && d !== null) return `${b} – ${d}`;
    if (d !== null) return `– ${d}`;
    // Żyjący → sam rok urodzenia (bez kreski i daty śmierci).
    if (b !== null) return isDeceased ? `${b} – ${word}` : `${b}`;
    return isDeceased ? word : null;
  }

  private guessLiving(birthYear: number | null, hasDeathTag: boolean): boolean {
    if (hasDeathTag) return false;
    if (birthYear === null) return false; // brak danych historyczny — nie oznaczamy jako żyjący
    const currentYear = new Date().getFullYear();
    return currentYear - birthYear < 100;
  }

  private computeGraphFlags(ctx: BuildContext): void {
    // childCount: ile dzieci ma osoba po wszystkich związkach.
    const childCountByIndi = new Map<string, number>();
    // mapuj familyId → liczba dzieci
    const childrenByFamily = new Map<string, number>();
    for (const fc of ctx.familyChildren) {
      childrenByFamily.set(fc.familyId, (childrenByFamily.get(fc.familyId) ?? 0) + 1);
    }
    for (const fam of ctx.families.values()) {
      const n = childrenByFamily.get(fam.id) ?? 0;
      if (n === 0) continue;
      for (const parentId of [fam.husbandId, fam.wifeId]) {
        if (parentId) childCountByIndi.set(parentId, (childCountByIndi.get(parentId) ?? 0) + n);
      }
    }

    for (const indi of ctx.individuals.values()) {
      indi.childCount = childCountByIndi.get(indi.id) ?? 0;
      const famcXref = ctx.childFamilyOf.get(indi.xref);
      const fam = famcXref ? ctx.families.get(famcXref) : undefined;
      indi.hasParents = !!fam && (!!fam.husbandId || !!fam.wifeId);
    }
  }

  private async wipeTree(m: EntityManager, treeName: string): Promise<void> {
    const existing = await m.findOne(Tree, { where: { name: treeName } });
    if (!existing) return;
    const treeId = existing.id;
    this.logger.log(`Czyszczę istniejące drzewo "${treeName}" (${treeId})`);
    await m.delete(Event, { treeId });
    await m.delete(FamilyChild, { treeId });
    await m.delete(Family, { treeId });
    await m.delete(Individual, { treeId });
    await m.delete(Place, { treeId });
    await m.delete(Source, { treeId });
    await m.delete(Media, { treeId });
    await m.delete(Tree, { id: treeId });
  }

  private async saveChunked<T extends object>(
    m: EntityManager,
    entity: { new (): T },
    rows: T[],
    chunk = 300,
  ): Promise<void> {
    for (let i = 0; i < rows.length; i += chunk) {
      await m.save(entity, rows.slice(i, i + chunk) as T[]);
    }
  }
}
