import type { Bundle, BundlePayload, PersonCard, SpouseRelation } from '@rodno/shared';

interface GraphUnion {
  spouseId: string | null;
  relation: SpouseRelation | null;
  childIds: string[];
}

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
const H_GAP = 30;
const SPOUSE_GAP = H_GAP; // odstęp w parze = odstęp między rodzeństwem
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

interface DUnion {
  spouseId: string | null;
  relation: SpouseRelation | null;
  kids: DNode[];
}

interface DNode {
  id: string;
  /** Pierwszy związek → po prawej; drugi → po lewej; kolejne (extras) doklejone z prawej bez dzieci. */
  right: DUnion | null;
  left: DUnion | null;
  extras: string[];
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
  private readonly unions = new Map<string, GraphUnion[]>();
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
    // Związki (każdy: małżonek + relacja + dzieci). spouse/children/spouseRel = kompat (1. związek / wszystkie dzieci).
    const us: GraphUnion[] = (b.unions ?? []).map((u) => {
      if (u.spouse) this.cards.set(u.spouse.id, u.spouse);
      const childIds = u.children.map((c) => {
        this.cards.set(c.id, c);
        return c.id;
      });
      return { spouseId: u.spouse?.id ?? null, relation: u.relation, childIds };
    });
    this.unions.set(sid, us);
    const firstU = us[0];
    this.spouse.set(sid, firstU?.spouseId ?? null);
    if (firstU?.spouseId && firstU.relation) {
      this.spouseRel.set(sid, firstU.relation);
      this.spouseRel.set(firstU.spouseId, firstU.relation);
    }
    this.children.set(sid, us.flatMap((u) => u.childIds));
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

  /** Czy znamy rodziców osoby (bundle wczytany) i czy ma ojca/matkę — do menu „dodaj". */
  parentInfo(id: string): { known: boolean; hasFather: boolean; hasMother: boolean } {
    const rel = this.parents.get(id);
    if (!rel) return { known: false, hasFather: false, hasMother: false };
    return { known: true, hasFather: !!rel.fatherId, hasMother: !!rel.motherId };
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
    // Relacja dziecko→para wprost z lasu potomków — działa też dla liści,
    // których własny bundle nie został pobrany (this.parents ich nie zna).
    const kidParents = new Map<string, { p1: string; p2: string | null }>();
    if (!this.cards.has(focalId)) {
      return { nodes: [], links: [], placeholders: [], width: 0, height: 0 };
    }

    /* ----- 1. struktura lasu potomków (para = jednostka, globalny visited) ----- */
    const dVisited = new Set<string>();
    const buildDesc = (id: string): DNode => {
      dVisited.add(id);
      const built: DUnion[] = (this.unions.get(id) ?? []).map((u) => {
        const sp =
          u.spouseId && this.cards.has(u.spouseId) && !dVisited.has(u.spouseId)
            ? u.spouseId
            : null;
        if (sp) dVisited.add(sp);
        const kids = u.childIds
          .filter((k) => this.cards.has(k) && !dVisited.has(k))
          .map((k) => buildDesc(k));
        return { spouseId: sp, relation: u.relation, kids };
      });
      return {
        id,
        right: built[0] ?? null,
        left: built[1] ?? null,
        extras: built.slice(2).map((u) => u.spouseId).filter((x): x is string => !!x),
      };
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

    const sumKids = (kids: DNode[]): number =>
      kids.length === 0
        ? 0
        : kids.reduce((a, k) => a + measureD(k), 0) + H_GAP * (kids.length - 1);

    // Geometria węzła względem lewej krawędzi karty osoby (=0). Para = jednostka.
    // Prawy związek rośnie w prawo, lewy w lewo. Gdy OBA związki mają dzieci, rozsuwamy
    // małżonków o szerokość dzieci, by grupy dzieci spotykały się na środku osoby (bez nakładania).
    const nodeGeom = (n: DNode) => {
      const pc = CARD_W / 2;
      const rkw = n.right ? sumKids(n.right.kids) : 0;
      const lkw = n.left ? sumKids(n.left.kids) : 0;
      // Gdy OBA związki mają dzieci: blok dzieci idzie z boku osoby, a małżonek jest
      // wyśrodkowany NAD swoimi dziećmi (blisko kreski w dół) — grupy się nie nakładają.
      const bothKids = rkw > 0 && lkw > 0;
      let right = CARD_W;
      let left = 0;
      let rsLeft: number | null = null;
      let rightCenter: number | null = null;
      let lsLeft: number | null = null;
      let leftCenter: number | null = null;

      if (n.right) {
        if (bothKids) {
          rightCenter = CARD_W + H_GAP + rkw / 2; // dzieci na prawo od osoby
          right = Math.max(right, CARD_W + H_GAP + rkw);
          if (n.right.spouseId) {
            rsLeft = rightCenter + SPOUSE_GAP; // żona DELIKATNIE W BOK (na prawo od kreski w dół)
            right = Math.max(right, rsLeft + CARD_W);
          }
        } else {
          if (n.right.spouseId) {
            rsLeft = CARD_W + SPOUSE_GAP;
            right = Math.max(right, rsLeft + CARD_W);
            rightCenter = (pc + rsLeft + CARD_W / 2) / 2;
          } else {
            rightCenter = pc;
          }
          if (rkw > 0) {
            right = Math.max(right, rightCenter + rkw / 2);
            left = Math.min(left, rightCenter - rkw / 2);
          }
        }
      }
      if (n.left) {
        if (bothKids) {
          leftCenter = -(H_GAP + lkw / 2);
          left = Math.min(left, -(H_GAP + lkw));
          if (n.left.spouseId) {
            lsLeft = leftCenter - SPOUSE_GAP - CARD_W; // żona delikatnie w bok (na lewo od kreski)
            left = Math.min(left, lsLeft);
          }
        } else {
          if (n.left.spouseId) {
            lsLeft = -SPOUSE_GAP - CARD_W;
            left = Math.min(left, lsLeft);
            leftCenter = (pc + lsLeft + CARD_W / 2) / 2;
          } else {
            leftCenter = pc;
          }
          if (lkw > 0) {
            left = Math.min(left, leftCenter - lkw / 2);
            right = Math.max(right, leftCenter + lkw / 2);
          }
        }
      }
      if (n.extras.length) right += n.extras.length * (CARD_W + SPOUSE_GAP);
      return { left, right, rsLeft, rightCenter, lsLeft, leftCenter };
    };

    const measureD = (n: DNode): number => {
      const g = nodeGeom(n);
      return g.right - g.left;
    };

    const placeKids = (kids: DNode[], centerX: number, depth: number) => {
      const total = sumKids(kids);
      let cl = centerX - total / 2;
      for (const kid of kids) {
        placeD(kid, cl, depth);
        cl += measureD(kid) + H_GAP;
      }
    };

    const placeD = (n: DNode, blockLeft: number, depth: number): number => {
      const g = nodeGeom(n);
      const personX = blockLeft - g.left;
      const y = depth * DY;
      const role: NodeRole = n.id === focalId ? 'focal' : depth === 0 ? 'ancestor' : 'descendant';
      pos.set(n.id, { card: this.cards.get(n.id)!, x: personX, y, role });

      let rightmost = personX + CARD_W;
      if (n.right) {
        if (n.right.spouseId && g.rsLeft !== null) {
          const rsX = personX + g.rsLeft;
          pos.set(n.right.spouseId, { card: this.cards.get(n.right.spouseId)!, x: rsX, y, role: 'spouse' });
          rightmost = Math.max(rightmost, rsX + CARD_W);
        }
        if (g.rightCenter !== null) {
          for (const k of n.right.kids) kidParents.set(k.id, { p1: n.id, p2: n.right.spouseId });
          placeKids(n.right.kids, personX + g.rightCenter, depth + 1);
        }
      }
      if (n.left) {
        if (n.left.spouseId && g.lsLeft !== null) {
          const lsX = personX + g.lsLeft;
          pos.set(n.left.spouseId, { card: this.cards.get(n.left.spouseId)!, x: lsX, y, role: 'spouse' });
        }
        if (g.leftCenter !== null) {
          for (const k of n.left.kids) kidParents.set(k.id, { p1: n.id, p2: n.left.spouseId });
          placeKids(n.left.kids, personX + g.leftCenter, depth + 1);
        }
      }
      for (const exId of n.extras) {
        const exX = rightmost + SPOUSE_GAP;
        pos.set(exId, { card: this.cards.get(exId)!, x: exX, y, role: 'spouse' });
        rightmost = exX + CARD_W;
      }
      return personX + CARD_W / 2;
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

    // Łączniki dziecko → rodzice. Grupujemy po parze rodziców: gdy rodzice OBOK siebie,
    // kreska od środka linii pary; gdy DALEKO (wiele związków), od kolorowej linii pary
    // nad środkiem dzieci (nie spod małżonka). Pojedynczy rodzic → spod niego.
    const families = new Map<string, { aId: string | null; bId: string | null; kids: PositionedNode[] }>();
    for (const [childId, c] of pos) {
      // Najpierw las (zna każde umieszczone dziecko), potem fallback na bundle (strona pedigree).
      const fp = kidParents.get(childId);
      const rel = this.parents.get(childId);
      const p1 = fp ? fp.p1 : rel?.fatherId ?? null;
      const p2 = fp ? fp.p2 : rel?.motherId ?? null;
      const aId = p1 && pos.has(p1) ? p1 : null;
      const bId = p2 && pos.has(p2) ? p2 : null;
      if (!aId && !bId) continue;
      const key = [aId ?? '', bId ?? ''].sort().join('|'); // kolejność rodziców bez znaczenia
      let g = families.get(key);
      if (!g) {
        g = { aId, bId, kids: [] };
        families.set(key, g);
      }
      g.kids.push(c);
    }
    for (const g of families.values()) {
      const a = g.aId ? pos.get(g.aId) : undefined;
      const b = g.bId ? pos.get(g.bId) : undefined;
      let x2: number;
      let y2: number;
      if (a && b) {
        y2 = Math.min(a.y, b.y) + CARD_H / 2; // wysokość linii pary
        if (Math.abs(a.x - b.x) <= CARD_W + 3 * SPOUSE_GAP) {
          x2 = (cx(a) + cx(b)) / 2; // para obok siebie → środek pary
        } else {
          const kc = (Math.min(...g.kids.map(cx)) + Math.max(...g.kids.map(cx))) / 2;
          x2 = kc; // para daleko → punkt na linii nad środkiem dzieci
        }
      } else {
        const p = (a ?? b)!;
        x2 = cx(p);
        y2 = p.y + CARD_H;
      }
      for (const c of g.kids) links.push({ x1: cx(c), y1: c.y, x2, y2, kind: 'parent' });
    }

    // Linie par — ciągłe, kolor wg typu związku. Po jednej dla KAŻDEGO związku osoby.
    const spouseSeen = new Set<string>();
    for (const [id] of pos) {
      for (const u of this.unions.get(id) ?? []) {
        if (!u.spouseId || !pos.has(u.spouseId) || !pos.has(id)) continue;
        const key = [id, u.spouseId].sort().join('|');
        if (spouseSeen.has(key)) continue;
        spouseSeen.add(key);
        const a = pos.get(id)!;
        const b = pos.get(u.spouseId)!;
        const left = a.x <= b.x ? a : b;
        const right = a.x <= b.x ? b : a;
        links.push({
          x1: left.x + CARD_W,
          y1: left.y + CARD_H / 2,
          x2: right.x,
          y2: right.y + CARD_H / 2,
          kind: 'spouse',
          relation: u.relation ?? 'married',
        });
      }
    }

    /* ------------------------- placeholdery „+ Ojciec/Matka" ------------------------- */
    const placeholders: PlaceholderNode[] = [];
    const PH_GAP = 8;
    const PH_W = (CARD_W - PH_GAP) / 2;
    const PH_H = 44;
    const PH_DY = 64;
    for (const [id, node] of pos) {
      // Tylko linia krwi — bez wżenionych małżonków (ich drzewo i tak ukryte).
      if (node.role === 'spouse') continue;
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
