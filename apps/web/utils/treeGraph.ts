import type { Bundle, BundlePayload, PersonCard, SpouseRelation } from '@rodno/shared';

/**
 * Silnik drzewa Rodno — część "layout" (spec §11: layout odseparowany od renderera).
 * Widok rodzinny wokół focal-a:
 *   • w dół: las potomków zakorzeniony na pokoleniu RODZICÓW — rodzice (para obok siebie)
 *     + ich rodzeństwo (wujowie/ciotki) z małżonkami; niżej focal + rodzeństwo + kuzyni
 *     (z małżonkami) i ich dzieci,
 *   • w górę: pedigree przodków — każda PARA obok siebie, pokolenia rozsuwane na szerokość,
 *   • placeholdery „+ Ojciec / + Matka" nad osobami bez rodziców w drzewie (jak MyHeritage).
 *
 * Layout = porządny tidy-tree: najpierw mierzymy szerokość poddrzew (para jako jednostka),
 * potem układamy bez nakładania, parę centrując w jej bloku → małżonkowie zawsze przy sobie.
 */

export const CARD_W = 210;
export const CARD_H = 92;
const SPOUSE_GAP = 14;
const H_GAP = 30;
const V_GAP = 76;
const DY = CARD_H + V_GAP;
const MARGIN = 56;

export type NodeRole = 'focal' | 'ancestor' | 'descendant' | 'spouse' | 'sibling';

export interface PositionedNode {
  card: PersonCard;
  x: number;
  y: number;
  role: NodeRole;
}

export interface PlaceholderNode {
  x: number;
  y: number;
  w: number;
  h: number;
  slot: 'father' | 'mother';
  forId: string;
  forName: string;
}

export interface TreeLink {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: 'parent' | 'spouse' | 'placeholder';
  relation?: SpouseRelation;
}

export interface TreeLayout {
  nodes: PositionedNode[];
  links: TreeLink[];
  placeholders: PlaceholderNode[];
  width: number;
  height: number;
}

interface DNode {
  id: string;
  spouseId: string | null;
  kids: DNode[];
}

interface ACouple {
  fatherId: string | null;
  motherId: string | null;
  fatherUp: ACouple | null;
  motherUp: ACouple | null;
}

export class TreeGraph {
  readonly cards = new Map<string, PersonCard>();
  private readonly parents = new Map<string, { fatherId: string | null; motherId: string | null }>();
  private readonly children = new Map<string, string[]>();
  private readonly spouse = new Map<string, string | null>();
  private readonly spouseRel = new Map<string, SpouseRelation>();
  private readonly siblings = new Map<string, string[]>();
  readonly expanded = new Set<string>();

  ingestBundle(b: Bundle): void {
    const sid = b.self.id;
    this.cards.set(sid, b.self);
    this.parents.set(sid, {
      fatherId: b.father?.id ?? null,
      motherId: b.mother?.id ?? null,
    });
    if (b.father) this.cards.set(b.father.id, b.father);
    if (b.mother) this.cards.set(b.mother.id, b.mother);
    if (b.spouse) {
      this.cards.set(b.spouse.id, b.spouse);
      this.spouse.set(sid, b.spouse.id);
      if (b.spouseRelation) {
        this.spouseRel.set(sid, b.spouseRelation);
        this.spouseRel.set(b.spouse.id, b.spouseRelation);
      }
    } else if (!this.spouse.has(sid)) {
      this.spouse.set(sid, null);
    }
    this.children.set(
      sid,
      b.children.map((c) => {
        this.cards.set(c.id, c);
        return c.id;
      }),
    );
    if (b.siblings) {
      this.siblings.set(
        sid,
        b.siblings.map((s) => {
          this.cards.set(s.id, s);
          return s.id;
        }),
      );
    }
    this.expanded.add(sid);
  }

  ingestPayload(p: BundlePayload): void {
    for (const b of p.bundles) this.ingestBundle(b);
  }

  hasCard(id: string): boolean {
    return this.cards.has(id);
  }

  canExpandUp(id: string): boolean {
    const card = this.cards.get(id);
    if (!card?.hasParents) return false;
    const rel = this.parents.get(id);
    return !rel || (!rel.fatherId && !rel.motherId);
  }

  canExpandDown(id: string): boolean {
    const card = this.cards.get(id);
    if (!card || card.childCount === 0) return false;
    return (this.children.get(id)?.length ?? 0) === 0;
  }

  private known(id: string | null | undefined): id is string {
    return !!id && this.cards.has(id);
  }

  private coupleWidth(hasSpouse: boolean): number {
    return hasSpouse ? 2 * CARD_W + SPOUSE_GAP : CARD_W;
  }

  /* --------------------------------- layout --------------------------------- */

  layout(focalId: string): TreeLayout {
    const pos = new Map<string, PositionedNode>();
    if (!this.cards.has(focalId)) {
      return { nodes: [], links: [], placeholders: [], width: 0, height: 0 };
    }

    /* ----- 1. struktura lasu potomków (para = jednostka, globalny visited) ----- */
    const dVisited = new Set<string>();
    const buildDesc = (id: string): DNode => {
      dVisited.add(id);
      const spId = this.spouse.get(id) ?? null;
      const spouseId = spId && this.cards.has(spId) && !dVisited.has(spId) ? spId : null;
      if (spouseId) dVisited.add(spouseId);
      const kids = (this.children.get(id) ?? [])
        .filter((k) => this.cards.has(k) && !dVisited.has(k))
        .map((k) => buildDesc(k));
      return { id, spouseId, kids };
    };

    const frel = this.parents.get(focalId);
    const fatherId = this.known(frel?.fatherId) ? frel!.fatherId! : null;
    const motherId = this.known(frel?.motherId) ? frel!.motherId! : null;

    let rootIds: string[];
    if (fatherId || motherId) {
      const patUncles = fatherId
        ? (this.siblings.get(fatherId) ?? []).filter((u) => this.known(u) && u !== fatherId)
        : [];
      const matUncles = motherId
        ? (this.siblings.get(motherId) ?? []).filter((u) => this.known(u) && u !== motherId)
        : [];
      rootIds = [];
      if (fatherId) rootIds.push(...patUncles, fatherId);
      else if (motherId) rootIds.push(motherId);
      if (fatherId) rootIds.push(...matUncles);
    } else {
      const sibs = (this.siblings.get(focalId) ?? []).filter((s) => this.known(s) && s !== focalId);
      rootIds = [...sibs, focalId];
    }
    const roots = rootIds.filter((r) => !dVisited.has(r)).map((r) => buildDesc(r));

    const measureD = (n: DNode): number => {
      const coupleW = this.coupleWidth(!!n.spouseId);
      if (n.kids.length === 0) return coupleW;
      const childrenW =
        n.kids.reduce((a, k) => a + measureD(k), 0) + H_GAP * (n.kids.length - 1);
      return Math.max(coupleW, childrenW);
    };

    const placeD = (n: DNode, blockLeft: number, depth: number): number => {
      const w = measureD(n);
      const coupleW = this.coupleWidth(!!n.spouseId);
      const centerX = blockLeft + w / 2;
      if (n.kids.length > 0) {
        const childrenW =
          n.kids.reduce((a, k) => a + measureD(k), 0) + H_GAP * (n.kids.length - 1);
        let cl = centerX - childrenW / 2;
        for (const kid of n.kids) {
          placeD(kid, cl, depth + 1);
          cl += measureD(kid) + H_GAP;
        }
      }
      const personX = centerX - coupleW / 2;
      const role: NodeRole = n.id === focalId ? 'focal' : depth === 0 ? 'ancestor' : 'descendant';
      pos.set(n.id, { card: this.cards.get(n.id)!, x: personX, y: depth * DY, role });
      if (n.spouseId) {
        pos.set(n.spouseId, {
          card: this.cards.get(n.spouseId)!,
          x: personX + CARD_W + SPOUSE_GAP,
          y: depth * DY,
          role: 'spouse',
        });
      }
      return centerX;
    };

    let forestLeft = 0;
    for (const root of roots) {
      placeD(root, forestLeft, 0);
      forestLeft += measureD(root) + H_GAP;
    }

    /* ----- 2. pedigree przodków (para = jednostka, pokolenia rozsuwane) ----- */
    const placedBefore = new Set<string>(pos.keys());
    const aVisited = new Set<string>(placedBefore);
    const buildAnc = (personId: string): ACouple | null => {
      const rel = this.parents.get(personId);
      const fId = this.known(rel?.fatherId) && !aVisited.has(rel!.fatherId!) ? rel!.fatherId! : null;
      const mId = this.known(rel?.motherId) && !aVisited.has(rel!.motherId!) ? rel!.motherId! : null;
      if (!fId && !mId) return null;
      if (fId) aVisited.add(fId);
      if (mId) aVisited.add(mId);
      return {
        fatherId: fId,
        motherId: mId,
        fatherUp: fId ? buildAnc(fId) : null,
        motherUp: mId ? buildAnc(mId) : null,
      };
    };

    const measureA = (c: ACouple): number => {
      const coupleW = this.coupleWidth(!!c.fatherId && !!c.motherId);
      const fW = c.fatherUp ? measureA(c.fatherUp) : 0;
      const mW = c.motherUp ? measureA(c.motherUp) : 0;
      const above = fW + mW + (fW > 0 && mW > 0 ? H_GAP : 0);
      return Math.max(coupleW, above);
    };

    const placeA = (c: ACouple, blockLeft: number, depth: number): void => {
      const coupleW = this.coupleWidth(!!c.fatherId && !!c.motherId);
      const w = measureA(c);
      const centerX = blockLeft + w / 2;
      const y = -depth * DY;
      if (c.fatherId && c.motherId) {
        const fx = centerX - coupleW / 2;
        pos.set(c.fatherId, { card: this.cards.get(c.fatherId)!, x: fx, y, role: 'ancestor' });
        pos.set(c.motherId, {
          card: this.cards.get(c.motherId)!,
          x: fx + CARD_W + SPOUSE_GAP,
          y,
          role: 'ancestor',
        });
      } else {
        const only = (c.fatherId ?? c.motherId)!;
        pos.set(only, { card: this.cards.get(only)!, x: centerX - CARD_W / 2, y, role: 'ancestor' });
      }
      const fW = c.fatherUp ? measureA(c.fatherUp) : 0;
      const mW = c.motherUp ? measureA(c.motherUp) : 0;
      const above = fW + mW + (fW > 0 && mW > 0 ? H_GAP : 0);
      const aboveLeft = centerX - above / 2;
      if (c.fatherUp) placeA(c.fatherUp, aboveLeft, depth + 1);
      if (c.motherUp) placeA(c.motherUp, aboveLeft + fW + (fW > 0 && mW > 0 ? H_GAP : 0), depth + 1);
    };

    // Kotwica: nad parą rodziców focal-a kładziemy przodków ojca (lewo) i matki (prawo).
    const fNode = fatherId ? pos.get(fatherId) : undefined;
    const mNode = motherId ? pos.get(motherId) : undefined;
    if (fNode || mNode) {
      const anchorCenter = fNode && mNode
        ? (fNode.x + CARD_W / 2 + mNode.x + CARD_W / 2) / 2
        : ((fNode ?? mNode)!.x + CARD_W / 2);
      const patCouple = fatherId ? buildAnc(fatherId) : null;
      const matCouple = motherId ? buildAnc(motherId) : null;
      const patW = patCouple ? measureA(patCouple) : 0;
      const matW = matCouple ? measureA(matCouple) : 0;
      const aboveW = patW + matW + (patW > 0 && matW > 0 ? H_GAP : 0);
      const aboveLeft = anchorCenter - aboveW / 2;
      if (patCouple) placeA(patCouple, aboveLeft, 1);
      if (matCouple) placeA(matCouple, aboveLeft + patW + (patW > 0 && matW > 0 ? H_GAP : 0), 1);
    } else {
      // Fallback (focal bez rodziców): pedigree focal-a (gdyby jakieś były).
      const c = buildAnc(focalId);
      if (c) {
        const fn = pos.get(focalId)!;
        placeA(c, fn.x + CARD_W / 2 - measureA(c) / 2, 1);
      }
    }

    /* --------------------------------- linki --------------------------------- */
    const links: TreeLink[] = [];
    const cx = (n: PositionedNode) => n.x + CARD_W / 2;

    // Dziecko → JEDNA linia od punktu między rodzicami (linii pary) w dół.
    const linkedChild = new Set<string>();
    for (const [childId, c] of pos) {
      if (linkedChild.has(childId)) continue;
      const rel = this.parents.get(childId);
      if (!rel) continue;
      const f = rel.fatherId ? pos.get(rel.fatherId) : undefined;
      const m = rel.motherId ? pos.get(rel.motherId) : undefined;
      let x2: number;
      let y2: number;
      if (f && m) {
        x2 = (cx(f) + cx(m)) / 2;
        y2 = Math.min(f.y, m.y) + CARD_H / 2;
      } else if (f) {
        x2 = cx(f);
        y2 = f.y + CARD_H;
      } else if (m) {
        x2 = cx(m);
        y2 = m.y + CARD_H;
      } else {
        continue;
      }
      linkedChild.add(childId);
      links.push({ x1: cx(c), y1: c.y, x2, y2, kind: 'parent' });
    }

    // Linie par — ciągłe, kolor wg typu związku.
    const spouseSeen = new Set<string>();
    for (const [id] of pos) {
      const sp = this.spouse.get(id);
      if (!sp || !pos.has(sp)) continue;
      const key = [id, sp].sort().join('|');
      if (spouseSeen.has(key)) continue;
      spouseSeen.add(key);
      const a = pos.get(id)!;
      const b = pos.get(sp)!;
      const left = a.x <= b.x ? a : b;
      const right = a.x <= b.x ? b : a;
      links.push({
        x1: left.x + CARD_W,
        y1: left.y + CARD_H / 2,
        x2: right.x,
        y2: right.y + CARD_H / 2,
        kind: 'spouse',
        relation: this.spouseRel.get(id) ?? this.spouseRel.get(sp) ?? 'married',
      });
    }

    /* ------------------------- placeholdery „+ Ojciec/Matka" ------------------------- */
    const placeholders: PlaceholderNode[] = [];
    const PH_GAP = 8;
    const PH_W = (CARD_W - PH_GAP) / 2;
    const PH_H = 44;
    const PH_DY = 64;
    for (const [id, node] of pos) {
      // Każda osoba bez rodziców w drzewie — też wżenieni małżonkowie (jak MyHeritage).
      if (node.card.hasParents) continue;
      const y = node.y - PH_DY;
      placeholders.push(
        { x: node.x, y, w: PH_W, h: PH_H, slot: 'father', forId: id, forName: node.card.name },
        { x: node.x + PH_W + PH_GAP, y, w: PH_W, h: PH_H, slot: 'mother', forId: id, forName: node.card.name },
      );
      links.push({
        x1: node.x + CARD_W / 2,
        y1: node.y,
        x2: node.x + CARD_W / 2,
        y2: y + PH_H,
        kind: 'placeholder',
      });
    }

    /* ------------------------------- normalizacja ------------------------------- */
    const nodes = [...pos.values()];
    const allX = [
      ...nodes.map((n) => n.x),
      ...nodes.map((n) => n.x + CARD_W),
      ...placeholders.map((p) => p.x),
      ...placeholders.map((p) => p.x + p.w),
    ];
    const allY = [
      ...nodes.map((n) => n.y),
      ...nodes.map((n) => n.y + CARD_H),
      ...placeholders.map((p) => p.y),
      ...placeholders.map((p) => p.y + p.h),
    ];
    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);
    const offX = MARGIN - minX;
    const offY = MARGIN - minY;
    for (const n of nodes) {
      n.x += offX;
      n.y += offY;
    }
    for (const ph of placeholders) {
      ph.x += offX;
      ph.y += offY;
    }
    for (const l of links) {
      l.x1 += offX;
      l.y1 += offY;
      l.x2 += offX;
      l.y2 += offY;
    }

    return {
      nodes,
      links,
      placeholders,
      width: maxX - minX + MARGIN * 2,
      height: maxY - minY + MARGIN * 2,
    };
  }
}
