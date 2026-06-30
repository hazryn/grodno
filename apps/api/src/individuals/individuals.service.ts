import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository } from 'typeorm';
import type {
  Bundle,
  BundlePayload,
  EventDto,
  IndividualDto,
  MediaDto,
  PersonCard,
  PlaceDto,
  SpouseRelation,
  Union,
} from '@rodno/shared';
import {
  Event,
  Individual,
  Media,
  ParentChild,
  Partnership,
  Place,
} from '../database/entities';
import { MediaService } from '../media/media.service';

@Injectable()
export class IndividualsService {
  constructor(
    @InjectRepository(Individual) private readonly indiRepo: Repository<Individual>,
    @InjectRepository(ParentChild) private readonly pcRepo: Repository<ParentChild>,
    @InjectRepository(Partnership) private readonly partnerRepo: Repository<Partnership>,
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
    @InjectRepository(Media) private readonly mediaRepo: Repository<Media>,
    @InjectRepository(Place) private readonly placeRepo: Repository<Place>,
    private readonly media: MediaService,
  ) {}

  /* ------------------------------- kafelek/bundle ------------------------------- */

  toCard(indi: Individual): PersonCard {
    return {
      id: indi.id,
      xref: indi.xref,
      name: indi.primaryName,
      sex: indi.sex,
      birth: indi.birthYear != null ? String(indi.birthYear) : null,
      death: indi.deathYear != null ? String(indi.deathYear) : null,
      lifespan: indi.lifespan,
      birthplace: indi.birthPlaceTown,
      birthplaceFull: indi.birthPlaceFull,
      photoUrl: this.media.presign(indi.photoUrl),
      linkedinUrl: indi.linkedinUrl,
      facebookUrl: indi.facebookUrl,
      deceased: indi.deceased,
      hasParents: indi.hasParents,
      childCount: indi.childCount,
      isLiving: indi.isLiving,
    };
  }

  private async loadIndi(id: string | null): Promise<Individual | null> {
    if (!id) return null;
    return this.indiRepo.findOne({ where: { id } });
  }

  private async loadOrdered(ids: string[]): Promise<Individual[]> {
    if (ids.length === 0) return [];
    const rows = await this.indiRepo.find({ where: { id: In(ids) } });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids
      .map((id) => byId.get(id))
      .filter((x): x is Individual => x !== undefined);
  }

  /** Rozdziela krawędzie-rodziców osoby na ojca/matkę (rola, z fallbackiem dla 'parent'). */
  private async resolveParents(
    childId: string,
  ): Promise<{ fatherId: string | null; motherId: string | null }> {
    const edges = await this.pcRepo.find({ where: { childId } });
    let fatherId = edges.find((e) => e.parentRole === 'father')?.parentId ?? null;
    let motherId = edges.find((e) => e.parentRole === 'mother')?.parentId ?? null;
    // Rola 'parent' (nieokreślona) → wypełnij wolny slot.
    for (const e of edges.filter((e) => e.parentRole === 'parent')) {
      if (!fatherId) fatherId = e.parentId;
      else if (!motherId && e.parentId !== fatherId) motherId = e.parentId;
    }
    return { fatherId, motherId };
  }

  /**
   * Buduje bundle osoby z modelu KRAWĘDZIOWEGO (parent_child + partnerships):
   * rodzice z krawędzi childId=indi; związki = partnerstwa ∪ współrodzice wyprowadzeni
   * z dzieci; rodzeństwo = pełne (wspólni rodzice). Kontrakt `unions` jak dotąd.
   */
  private async buildBundle(
    indi: Individual,
    withSiblings: boolean,
  ): Promise<{
    bundle: Bundle;
    father: Individual | null;
    mother: Individual | null;
    spouse: Individual | null;
    childEnts: Individual[];
    siblingEnts: Individual[];
  }> {
    // --- rodzice ---
    const { fatherId, motherId } = await this.resolveParents(indi.id);
    const father = await this.loadIndi(fatherId);
    const mother = await this.loadIndi(motherId);

    // --- rodzeństwo pełne (te same krawędzie rodziców) ---
    let siblingEnts: Individual[] = [];
    if (withSiblings && (fatherId || motherId)) {
      const primaryId = fatherId ?? motherId!;
      const otherId = fatherId ? motherId : null;
      const primEdges = await this.pcRepo.find({
        where: { parentId: primaryId },
        order: { sortOrder: 'ASC' },
      });
      let sibIds = primEdges.map((e) => e.childId).filter((cid) => cid !== indi.id);
      if (otherId) {
        const otherEdges = await this.pcRepo.find({ where: { parentId: otherId } });
        const otherSet = new Set(otherEdges.map((e) => e.childId));
        sibIds = sibIds.filter((cid) => otherSet.has(cid)); // pełne rodzeństwo
      }
      siblingEnts = await this.loadOrdered(sibIds);
    }

    // --- dzieci indi + współrodzic każdego dziecka ---
    const childEdges = await this.pcRepo.find({
      where: { parentId: indi.id },
      order: { sortOrder: 'ASC' },
    });
    const childIds = childEdges.map((e) => e.childId);
    const coParentByChild = new Map<string, string | null>();
    if (childIds.length) {
      const allEdges = await this.pcRepo.find({ where: { childId: In(childIds) } });
      const parentsByChild = new Map<string, string[]>();
      for (const e of allEdges) {
        const arr = parentsByChild.get(e.childId) ?? [];
        arr.push(e.parentId);
        parentsByChild.set(e.childId, arr);
      }
      for (const cid of childIds) {
        const co = (parentsByChild.get(cid) ?? []).find((p) => p !== indi.id) ?? null;
        coParentByChild.set(cid, co);
      }
    }
    const childrenByCoParent = new Map<string | null, string[]>();
    for (const cid of childIds) {
      const co = coParentByChild.get(cid) ?? null;
      const arr = childrenByCoParent.get(co) ?? [];
      arr.push(cid);
      childrenByCoParent.set(co, arr);
    }

    // --- partnerstwa (kolejność związków + typ) ---
    const partnerships = await this.partnerRepo.find({
      where: [{ partnerAId: indi.id }, { partnerBId: indi.id }],
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    const relBySpouse = new Map<string, SpouseRelation>();
    const unionSpouseIds: (string | null)[] = [];
    for (const p of partnerships) {
      const sid = p.partnerAId === indi.id ? p.partnerBId : p.partnerAId;
      if (sid && !unionSpouseIds.includes(sid)) {
        unionSpouseIds.push(sid);
        relBySpouse.set(sid, p.type);
      }
    }
    // współrodzice z dzieci, których nie objęło partnerstwo
    for (const co of childrenByCoParent.keys()) {
      if (co !== null && !unionSpouseIds.includes(co)) unionSpouseIds.push(co);
    }
    if (childrenByCoParent.has(null)) unionSpouseIds.push(null); // dzieci bez 2. rodzica

    // --- załaduj osoby i zbuduj unie ---
    const childById = new Map(
      (await this.loadOrdered(childIds)).map((c) => [c.id, c]),
    );
    const spouseById = new Map(
      (await this.loadOrdered(
        unionSpouseIds.filter((x): x is string => !!x),
      )).map((s) => [s.id, s]),
    );

    const unions: Union[] = [];
    const childEnts: Individual[] = [];
    const seenChild = new Set<string>();
    let spouse: Individual | null = null;
    for (let i = 0; i < unionSpouseIds.length; i++) {
      const sid = unionSpouseIds[i];
      const sp = sid ? spouseById.get(sid) ?? null : null;
      if (i === 0) spouse = sp;
      const kidEnts = (childrenByCoParent.get(sid) ?? [])
        .map((id) => childById.get(id))
        .filter((x): x is Individual => !!x);
      for (const c of kidEnts) {
        if (!seenChild.has(c.id)) {
          seenChild.add(c.id);
          childEnts.push(c);
        }
      }
      unions.push({
        spouse: sp ? this.toCard(sp) : null,
        relation: sp ? relBySpouse.get(sp.id) ?? 'partner' : null,
        children: kidEnts.map((c) => this.toCard(c)),
      });
    }
    const spouseRelation: SpouseRelation | null = unions[0]?.relation ?? null;

    const bundle: Bundle = {
      self: this.toCard(indi),
      father: father ? this.toCard(father) : null,
      mother: mother ? this.toCard(mother) : null,
      spouse: spouse ? this.toCard(spouse) : null,
      spouseRelation,
      children: unions[0]?.children ?? [],
      unions,
    };
    if (withSiblings) {
      bundle.siblings = siblingEnts.map((s) => this.toCard(s));
    }

    return { bundle, father, mother, spouse, childEnts, siblingEnts };
  }

  async getBundle(id: string): Promise<Bundle> {
    const indi = await this.indiRepo.findOne({ where: { id } });
    if (!indi) throw new NotFoundException(`Osoba ${id} nie istnieje`);
    const { bundle } = await this.buildBundle(indi, true);
    return bundle;
  }

  /** Głęboki payload startowy: focal + `up` pokoleń przodków + `down` potomków (+ rodzeństwo focal-a). */
  async getPayload(id: string, up: number, down: number): Promise<BundlePayload> {
    const focal = await this.indiRepo.findOne({ where: { id } });
    if (!focal) throw new NotFoundException(`Osoba ${id} nie istnieje`);

    const map = new Map<string, Bundle>();
    const collect = async (
      indi: Individual,
      upLeft: number,
      downLeft: number,
      withSiblings: boolean,
    ): Promise<void> => {
      if (map.has(indi.id)) return;
      const built = await this.buildBundle(indi, withSiblings);
      map.set(indi.id, built.bundle);

      if (upLeft > 0) {
        if (built.father) await collect(built.father, upLeft - 1, 0, false);
        if (built.mother) await collect(built.mother, upLeft - 1, 0, false);
      }
      if (downLeft > 0) {
        for (const child of built.childEnts) {
          await collect(child, 0, downLeft - 1, false);
        }
      }
      if (withSiblings) {
        // Rodzeństwo rozwinięte w dół na 2 pokolenia: dzieci rodzeństwa + ich dzieci
        // (z małżonkami — bo bundle każdej osoby niesie kartę małżonka).
        for (const sib of built.siblingEnts) {
          await collect(sib, 0, 2, false);
        }
      }
    };

    await collect(focal, up, down, true);

    // Wujowie/ciotki: rodzeństwo OBOJGA rodziców + ich małżonkowie + dzieci (kuzyni)
    // + małżonkowie i dzieci kuzynów. Dzięki temu front może pokazać potomków dziadków.
    const focalBuilt = await this.buildBundle(focal, true);
    for (const parent of [focalBuilt.father, focalBuilt.mother]) {
      if (!parent) continue;
      const pb = await this.buildBundle(parent, true);
      map.set(parent.id, pb.bundle); // bundle rodzica z rodzeństwem (= wujowie/ciotki)
      for (const uncle of pb.siblingEnts) {
        await collect(uncle, 0, 2, false);
      }
    }

    return { focal: focal.id, bundles: [...map.values()] };
  }

  /* --------------------------------- detal/list --------------------------------- */

  private placeDto(p: Place): PlaceDto {
    return {
      id: p.id,
      name: p.name,
      town: p.town,
      type: p.type,
      parentId: p.parentId,
      lat: p.lat,
      lng: p.lng,
      countryCode: p.countryCode,
    };
  }

  async getIndividual(id: string): Promise<IndividualDto> {
    const indi = await this.indiRepo.findOne({ where: { id } });
    if (!indi) throw new NotFoundException(`Osoba ${id} nie istnieje`);

    const events = await this.eventRepo.find({
      where: { individualId: id },
      order: { sortKey: 'ASC', createdAt: 'ASC' },
    });

    const placeIds = [
      ...new Set(events.map((e) => e.placeId).filter((x): x is string => !!x)),
    ];
    const places = placeIds.length
      ? await this.placeRepo.find({ where: { id: In(placeIds) } })
      : [];
    const placeById = new Map(places.map((p) => [p.id, p]));

    const toEventDto = (e: Event): EventDto => {
      const place = e.placeId ? placeById.get(e.placeId) : undefined;
      return {
        id: e.id,
        ownerType: e.ownerType,
        type: e.type,
        date: e.date,
        place: place
          ? this.placeDto(place)
          : e.placeName
            ? { id: '', name: e.placeName, town: e.placeName.split(',')[0]?.trim() ?? null, type: null, parentId: null, lat: null, lng: null, countryCode: null }
            : null,
        value: e.value,
      };
    };

    const eventDtos = events.map(toEventDto);
    const birth = eventDtos.find((e) => e.type === 'BIRT') ?? null;
    const death = eventDtos.find((e) => e.type === 'DEAT') ?? null;

    const media: MediaDto[] = [];
    if (indi.photoMediaId) {
      const m = await this.mediaRepo.findOne({ where: { id: indi.photoMediaId } });
      if (m) {
        media.push({
          id: m.id,
          title: m.title,
          filename: m.filename,
          format: m.format,
          url: this.media.presign(m.filename),
        });
      }
    }

    return {
      id: indi.id,
      treeId: indi.treeId,
      xref: indi.xref,
      sex: indi.sex,
      names: indi.names,
      primaryName: indi.primaryName,
      isLiving: indi.isLiving,
      birth,
      death,
      events: eventDtos,
      media,
      photoUrl: this.media.presign(indi.photoUrl),
      bio: indi.bio ?? null,
      linkedinUrl: indi.linkedinUrl,
      xUrl: indi.xUrl,
      facebookUrl: indi.facebookUrl,
      emails: indi.emails ?? [],
      experience: indi.experience ?? [],
      links: indi.links ?? [],
    };
  }

  async list(treeId: string, search: string | undefined, limit: number): Promise<PersonCard[]> {
    const where = search
      ? { treeId, primaryName: ILike(`%${search}%`) }
      : { treeId };
    const rows = await this.indiRepo.find({
      where,
      order: { primaryName: 'ASC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
    return rows.map((r) => this.toCard(r));
  }
}
