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
  Family,
  FamilyChild,
  Individual,
  Media,
  Place,
} from '../database/entities';

@Injectable()
export class IndividualsService {
  constructor(
    @InjectRepository(Individual) private readonly indiRepo: Repository<Individual>,
    @InjectRepository(Family) private readonly famRepo: Repository<Family>,
    @InjectRepository(FamilyChild) private readonly fcRepo: Repository<FamilyChild>,
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
    @InjectRepository(Media) private readonly mediaRepo: Repository<Media>,
    @InjectRepository(Place) private readonly placeRepo: Repository<Place>,
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
      photoUrl: indi.photoUrl,
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

  /**
   * Buduje bundle osoby + zwraca encje sąsiadów (do rekurencji w payload, bez ponownych zapytań).
   * Port logiki sprawdzonego modułu webtrees: rodzice z rodziny rodzicielskiej,
   * małżonek + dzieci z PIERWSZEJ rodziny małżeńskiej, opcjonalnie rodzeństwo.
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
    let father: Individual | null = null;
    let mother: Individual | null = null;
    let siblingEnts: Individual[] = [];

    const childFc = await this.fcRepo.findOne({
      where: { childId: indi.id },
      order: { sortOrder: 'ASC' },
    });
    if (childFc) {
      const fam = await this.famRepo.findOne({ where: { id: childFc.familyId } });
      if (fam) {
        father = await this.loadIndi(fam.husbandId);
        mother = await this.loadIndi(fam.wifeId);
        if (withSiblings) {
          const sibFcs = await this.fcRepo.find({
            where: { familyId: fam.id },
            order: { sortOrder: 'ASC' },
          });
          const sibIds = sibFcs
            .map((s) => s.childId)
            .filter((cid) => cid !== indi.id);
          siblingEnts = await this.loadOrdered(sibIds);
        }
      }
    }

    // WSZYSTKIE związki osoby (mąż/żona, potem partner itd.), każdy ze swoimi dziećmi.
    const spouseFams = await this.famRepo.find({
      where: [{ husbandId: indi.id }, { wifeId: indi.id }],
      order: { createdAt: 'ASC' },
    });
    const unions: Union[] = [];
    const childEnts: Individual[] = []; // wszystkie dzieci (do trawersacji payloadu)
    const seenChild = new Set<string>();
    let spouse: Individual | null = null;
    for (let i = 0; i < spouseFams.length; i++) {
      const fam = spouseFams[i]!;
      const spId = fam.husbandId === indi.id ? fam.wifeId : fam.husbandId;
      const sp = await this.loadIndi(spId);
      if (i === 0) spouse = sp;
      const childFcs = await this.fcRepo.find({
        where: { familyId: fam.id },
        order: { sortOrder: 'ASC' },
      });
      const unionChildren = await this.loadOrdered(childFcs.map((c) => c.childId));
      for (const c of unionChildren) {
        if (!seenChild.has(c.id)) {
          seenChild.add(c.id);
          childEnts.push(c);
        }
      }
      const marr = await this.eventRepo.findOne({
        where: { familyId: fam.id, type: 'MARR' },
      });
      unions.push({
        spouse: sp ? this.toCard(sp) : null,
        relation: sp ? (marr ? 'married' : 'partner') : null,
        children: unionChildren.map((c) => this.toCard(c)),
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
          url: null,
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
      photoUrl: indi.photoUrl,
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
