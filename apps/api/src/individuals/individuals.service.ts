import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type {
  Bundle,
  BundlePayload,
  EventDto,
  EventParticipantDto,
  GedcomDateValue,
  IndividualDto,
  MediaDto,
  MediaTagDto,
  PersonCard,
  PlaceDto,
  Sex,
  SpouseRelation,
  Union,
} from '@rodno/shared';
import { formatPersonName, gedcomDateSortKey, gedcomDateYear, parseGedcomDate } from '@rodno/shared';
import {
  Event,
  EventParticipant,
  Individual,
  Media,
  MediaTag,
  ParentChild,
  Partnership,
  Place,
} from '../database/entities';
import { MediaService } from '../media/media.service';

/** Body edycji osoby (pola opcjonalne — aktualizujemy tylko podane). */
export interface UpdateIndividualInput {
  names?: Individual['names'];
  sex?: Sex;
  bio?: string | null;
  linkedinUrl?: string | null;
  xUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  emails?: string[];
}

/** Body utworzenia/edycji zdarzenia osi czasu. */
export interface EventInput {
  type?: string;
  date?: GedcomDateValue | null;
  dateRaw?: string | null;
  placeName?: string | null;
  value?: string | null;
  participants?: Array<{
    individualId?: string | null;
    name?: string | null;
    role?: EventParticipantDto['role'];
    sortOrder?: number;
  }>;
}

export interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

@Injectable()
export class IndividualsService {
  constructor(
    @InjectRepository(Individual) private readonly indiRepo: Repository<Individual>,
    @InjectRepository(ParentChild) private readonly pcRepo: Repository<ParentChild>,
    @InjectRepository(Partnership) private readonly partnerRepo: Repository<Partnership>,
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
    @InjectRepository(EventParticipant)
    private readonly participantRepo: Repository<EventParticipant>,
    @InjectRepository(Media) private readonly mediaRepo: Repository<Media>,
    @InjectRepository(MediaTag) private readonly tagRepo: Repository<MediaTag>,
    @InjectRepository(Place) private readonly placeRepo: Repository<Place>,
    private readonly media: MediaService,
  ) {}

  /* ------------------------------- kafelek/bundle ------------------------------- */

  toCard(indi: Individual): PersonCard {
    return {
      id: indi.id,
      xref: indi.xref,
      name: indi.primaryName,
      displayName: formatPersonName(indi.names),
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

    // Zdarzenia osoby + zdarzenia jej partnerstw (ślub/rozwód są wspólne dla pary).
    const partnerships = await this.partnerRepo.find({
      where: [{ partnerAId: id }, { partnerBId: id }],
    });
    const partnershipIds = partnerships.map((p) => p.id);
    const events = await this.eventRepo.find({
      where: partnershipIds.length
        ? [{ individualId: id }, { partnershipId: In(partnershipIds) }]
        : { individualId: id },
      order: { sortKey: 'ASC', createdAt: 'ASC' },
    });

    const placeIds = [
      ...new Set(events.map((e) => e.placeId).filter((x): x is string => !!x)),
    ];
    const places = placeIds.length
      ? await this.placeRepo.find({ where: { id: In(placeIds) } })
      : [];
    const placeById = new Map(places.map((p) => [p.id, p]));

    // uczestnicy (chrzestni/świadkowie) pogrupowani po zdarzeniu
    const eventIds = events.map((e) => e.id);
    const participants = eventIds.length
      ? await this.participantRepo.find({
          where: { eventId: In(eventIds) },
          order: { sortOrder: 'ASC', createdAt: 'ASC' },
        })
      : [];
    const partByEvent = new Map<string, EventParticipantDto[]>();
    for (const p of participants) {
      const arr = partByEvent.get(p.eventId) ?? [];
      arr.push({
        id: p.id,
        individualId: p.individualId,
        name: p.name,
        role: p.role,
        sortOrder: p.sortOrder,
      });
      partByEvent.set(p.eventId, arr);
    }

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
        participants: partByEvent.get(e.id) ?? [],
      };
    };

    const eventDtos = events.map(toEventDto);
    const birth = eventDtos.find((e) => e.type === 'BIRT') ?? null;
    const death = eventDtos.find((e) => e.type === 'DEAT') ?? null;

    const media: MediaDto[] = [];
    if (indi.photoMediaId) {
      const m = await this.mediaRepo.findOne({ where: { id: indi.photoMediaId } });
      if (m) media.push(await this.toMediaDto(m));
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
      instagramUrl: indi.instagramUrl,
      emails: indi.emails ?? [],
      experience: indi.experience ?? [],
      links: indi.links ?? [],
    };
  }

  /* ----------------------------------- media DTO ----------------------------------- */

  private async toMediaDto(m: Media): Promise<MediaDto> {
    const tags = await this.tagRepo.find({ where: { mediaId: m.id } });
    return {
      id: m.id,
      title: m.title,
      filename: m.filename,
      format: m.format,
      url: this.media.presign(m.storageKey ?? m.filename),
      caption: m.caption,
      takenDate: m.takenDate,
      width: m.width,
      height: m.height,
      sortOrder: m.sortOrder,
      isAvatar: m.isAvatar,
      tags: tags.map(
        (t): MediaTagDto => ({
          id: t.id,
          mediaId: t.mediaId,
          individualId: t.individualId,
          name: t.name,
          x: t.x,
          y: t.y,
          w: t.w,
          h: t.h,
        }),
      ),
    };
  }

  /* ------------------------------------ zapis: osoba ------------------------------------ */

  async updateIndividual(id: string, input: UpdateIndividualInput): Promise<IndividualDto> {
    const indi = await this.indiRepo.findOne({ where: { id } });
    if (!indi) throw new NotFoundException(`Osoba ${id} nie istnieje`);

    if (input.names !== undefined) {
      indi.names = input.names;
      indi.primaryName = input.names[0]?.full?.trim() || indi.primaryName;
    }
    if (input.sex !== undefined) indi.sex = input.sex;
    if (input.bio !== undefined) indi.bio = input.bio;
    if (input.linkedinUrl !== undefined) indi.linkedinUrl = input.linkedinUrl;
    if (input.xUrl !== undefined) indi.xUrl = input.xUrl;
    if (input.facebookUrl !== undefined) indi.facebookUrl = input.facebookUrl;
    if (input.instagramUrl !== undefined) indi.instagramUrl = input.instagramUrl;
    if (input.emails !== undefined) indi.emails = input.emails;

    // płeć zmienia słowo w lifespanie
    indi.lifespan = this.buildLifespan(indi.birthYear, indi.deathYear, indi.deceased, indi.sex);

    await this.indiRepo.save(indi);
    return this.getIndividual(id);
  }

  /* ------------------------------------ zapis: avatar ------------------------------------ */

  async uploadAvatar(id: string, file: UploadedFile): Promise<IndividualDto> {
    const indi = await this.indiRepo.findOne({ where: { id } });
    if (!indi) throw new NotFoundException(`Osoba ${id} nie istnieje`);

    const prevId = indi.photoMediaId;
    const key = `avatars/${randomUUID()}.${this.extFromMime(file.mimetype)}`;
    await this.media.putObject(key, file.buffer, file.mimetype);

    const m = this.mediaRepo.create({
      treeId: indi.treeId,
      individualId: indi.id,
      storageKey: key,
      mimeType: file.mimetype,
      title: file.originalname ?? null,
      isAvatar: true,
      sortOrder: 0,
    });
    await this.mediaRepo.save(m);

    indi.photoMediaId = m.id;
    indi.photoUrl = key;
    await this.indiRepo.save(indi);

    // skasuj poprzedni avatar (tylko jeśli był wgrany przez UI)
    if (prevId && prevId !== m.id) {
      const prev = await this.mediaRepo.findOne({ where: { id: prevId } });
      if (prev?.isAvatar && prev.storageKey) {
        await this.media.deleteObject(prev.storageKey).catch(() => undefined);
        await this.mediaRepo.delete(prev.id);
      }
    }
    return this.getIndividual(id);
  }

  /* ------------------------------------ zapis: galeria ------------------------------------ */

  async listGallery(id: string): Promise<MediaDto[]> {
    const rows = await this.mediaRepo.find({
      where: { individualId: id, isAvatar: false },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    return Promise.all(rows.map((m) => this.toMediaDto(m)));
  }

  async uploadMedia(id: string, files: UploadedFile[]): Promise<MediaDto[]> {
    const indi = await this.indiRepo.findOne({ where: { id } });
    if (!indi) throw new NotFoundException(`Osoba ${id} nie istnieje`);

    const maxRow = await this.mediaRepo.findOne({
      where: { individualId: id, isAvatar: false },
      order: { sortOrder: 'DESC' },
    });
    let order = (maxRow?.sortOrder ?? -1) + 1;

    const created: Media[] = [];
    for (const file of files) {
      const key = `gallery/${randomUUID()}.${this.extFromMime(file.mimetype)}`;
      await this.media.putObject(key, file.buffer, file.mimetype);
      const m = this.mediaRepo.create({
        treeId: indi.treeId,
        individualId: indi.id,
        storageKey: key,
        mimeType: file.mimetype,
        title: file.originalname ?? null,
        isAvatar: false,
        sortOrder: order++,
      });
      created.push(await this.mediaRepo.save(m));
    }
    return Promise.all(created.map((m) => this.toMediaDto(m)));
  }

  async patchMedia(
    mediaId: string,
    input: { caption?: string | null; takenDate?: GedcomDateValue | string | null },
  ): Promise<MediaDto> {
    const m = await this.mediaRepo.findOne({ where: { id: mediaId } });
    if (!m) throw new NotFoundException(`Media ${mediaId} nie istnieje`);
    if (input.caption !== undefined) m.caption = input.caption;
    if (input.takenDate !== undefined) {
      m.takenDate =
        typeof input.takenDate === 'string'
          ? parseGedcomDate(input.takenDate)
          : input.takenDate;
    }
    await this.mediaRepo.save(m);
    return this.toMediaDto(m);
  }

  async reorderMedia(individualId: string, ids: string[]): Promise<void> {
    for (let i = 0; i < ids.length; i++) {
      await this.mediaRepo.update(
        { id: ids[i], individualId, isAvatar: false },
        { sortOrder: i },
      );
    }
  }

  async deleteMedia(mediaId: string): Promise<void> {
    const m = await this.mediaRepo.findOne({ where: { id: mediaId } });
    if (!m) throw new NotFoundException(`Media ${mediaId} nie istnieje`);
    if (m.storageKey) await this.media.deleteObject(m.storageKey).catch(() => undefined);
    await this.tagRepo.delete({ mediaId });
    await this.mediaRepo.delete(mediaId);
  }

  async putMediaTags(mediaId: string, tags: Array<Partial<MediaTagDto>>): Promise<MediaDto> {
    const m = await this.mediaRepo.findOne({ where: { id: mediaId } });
    if (!m) throw new NotFoundException(`Media ${mediaId} nie istnieje`);
    await this.tagRepo.delete({ mediaId });
    const rows = tags.map((t) =>
      this.tagRepo.create({
        treeId: m.treeId,
        mediaId,
        individualId: t.individualId ?? null,
        name: t.name ?? null,
        x: t.x ?? 0,
        y: t.y ?? 0,
        w: t.w ?? 0,
        h: t.h ?? 0,
      }),
    );
    if (rows.length) await this.tagRepo.save(rows);
    return this.toMediaDto(m);
  }

  /* ------------------------------------ zapis: oś czasu ------------------------------------ */

  /** Zdarzenia pary (wspólne dla obojga małżonków) — wiszą na partnerstwie, nie na osobie. */
  private static readonly COUPLE_EVENT_TYPES = new Set(['MARR', 'DIV', 'ENGA', 'MARB', 'ANUL']);

  async addEvent(individualId: string, input: EventInput): Promise<EventDto> {
    const indi = await this.indiRepo.findOne({ where: { id: individualId } });
    if (!indi) throw new NotFoundException(`Osoba ${individualId} nie istnieje`);
    const type = (input.type ?? 'EVEN').toUpperCase();
    const date = this.resolveDate(input);

    // Ślub/rozwód itp. → podepnij do partnerstwa, jeśli osoba ma małżonka (widoczne u obojga).
    let partnershipId: string | null = null;
    if (IndividualsService.COUPLE_EVENT_TYPES.has(type)) {
      const partnership = await this.partnerRepo.findOne({
        where: [{ partnerAId: individualId }, { partnerBId: individualId }],
        order: { sortOrder: 'ASC', createdAt: 'ASC' },
      });
      if (partnership) partnershipId = partnership.id;
    }

    const e = this.eventRepo.create({
      treeId: indi.treeId,
      ownerType: partnershipId ? 'family' : 'individual',
      individualId: partnershipId ? null : individualId,
      partnershipId,
      type,
      date,
      sortKey: gedcomDateSortKey(date),
      placeName: input.placeName ?? null,
      value: input.value ?? null,
    });
    await this.eventRepo.save(e);
    await this.saveParticipants(e.id, indi.treeId, input.participants);
    if (!partnershipId) await this.resyncVitals(individualId);
    return this.getEventDto(e.id);
  }

  async patchEvent(eventId: string, input: EventInput): Promise<EventDto> {
    const e = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!e) throw new NotFoundException(`Zdarzenie ${eventId} nie istnieje`);
    if (input.type !== undefined) e.type = input.type.toUpperCase();
    if (input.date !== undefined || input.dateRaw !== undefined) {
      e.date = this.resolveDate(input);
      e.sortKey = gedcomDateSortKey(e.date);
    }
    if (input.placeName !== undefined) e.placeName = input.placeName;
    if (input.value !== undefined) e.value = input.value;
    await this.eventRepo.save(e);
    if (input.participants !== undefined) {
      await this.participantRepo.delete({ eventId });
      await this.saveParticipants(eventId, e.treeId, input.participants);
    }
    if (e.individualId) await this.resyncVitals(e.individualId);
    return this.getEventDto(eventId);
  }

  async deleteEvent(eventId: string): Promise<void> {
    const e = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!e) throw new NotFoundException(`Zdarzenie ${eventId} nie istnieje`);
    await this.participantRepo.delete({ eventId });
    await this.eventRepo.delete(eventId);
    if (e.individualId) await this.resyncVitals(e.individualId);
  }

  private resolveDate(input: EventInput): GedcomDateValue | null {
    if (input.date !== undefined && input.date !== null) return input.date;
    if (input.dateRaw) return parseGedcomDate(input.dateRaw);
    return null;
  }

  private async saveParticipants(
    eventId: string,
    treeId: string,
    participants: EventInput['participants'],
  ): Promise<void> {
    if (!participants?.length) return;
    const rows = participants.map((p, i) =>
      this.participantRepo.create({
        treeId,
        eventId,
        individualId: p.individualId ?? null,
        name: p.name ?? null,
        role: p.role ?? 'other',
        sortOrder: p.sortOrder ?? i,
      }),
    );
    await this.participantRepo.save(rows);
  }

  private async getEventDto(eventId: string): Promise<EventDto> {
    const e = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!e) throw new NotFoundException(`Zdarzenie ${eventId} nie istnieje`);
    const parts = await this.participantRepo.find({
      where: { eventId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    const place = e.placeId ? await this.placeRepo.findOne({ where: { id: e.placeId } }) : null;
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
      participants: parts.map((p) => ({
        id: p.id,
        individualId: p.individualId,
        name: p.name,
        role: p.role,
        sortOrder: p.sortOrder,
      })),
    };
  }

  /** Przelicza zdenormalizowane pola urodzenia/śmierci + lifespan/deceased/isLiving z events. */
  private async resyncVitals(individualId: string): Promise<void> {
    const indi = await this.indiRepo.findOne({ where: { id: individualId } });
    if (!indi) return;
    const events = await this.eventRepo.find({ where: { individualId } });
    const birth = events.find((e) => e.type === 'BIRT') ?? null;
    const death = events.find((e) => e.type === 'DEAT') ?? null;

    indi.birthDate = birth?.date ?? null;
    indi.birthYear = gedcomDateYear(birth?.date);
    indi.birthPlaceId = birth?.placeId ?? null;
    indi.birthPlaceFull = birth?.placeName ?? null;
    indi.birthPlaceTown = birth?.placeId
      ? (await this.placeRepo.findOne({ where: { id: birth.placeId } }))?.town ?? null
      : birth?.placeName?.split(',')[0]?.trim() ?? null;

    indi.deathDate = death?.date ?? null;
    indi.deathYear = gedcomDateYear(death?.date);
    indi.deathPlaceId = death?.placeId ?? null;

    const hasDeath = death !== null;
    indi.deceased = this.guessDeceased(indi.birthYear, hasDeath);
    indi.isLiving = this.guessLiving(indi.birthYear, hasDeath);
    indi.lifespan = this.buildLifespan(indi.birthYear, indi.deathYear, indi.deceased, indi.sex);
    await this.indiRepo.save(indi);
  }

  /* --------------------------------- drobne helpery --------------------------------- */

  private extFromMime(mime: string): string {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'image/avif': 'avif',
      'image/heic': 'heic',
    };
    return map[mime] ?? 'bin';
  }

  private guessDeceased(birthYear: number | null, hasDeathTag: boolean): boolean {
    if (hasDeathTag) return true;
    return birthYear !== null && new Date().getFullYear() - birthYear > 120;
  }

  private guessLiving(birthYear: number | null, hasDeathTag: boolean): boolean {
    if (hasDeathTag) return false;
    if (birthYear === null) return false;
    return new Date().getFullYear() - birthYear < 100;
  }

  private buildLifespan(
    birth: number | null,
    death: number | null,
    isDeceased: boolean,
    sex: string,
  ): string | null {
    const b = birth ?? null;
    const d = death ?? null;
    const word = sex === 'F' ? 'zmarła' : sex === 'M' ? 'zmarły' : 'zmarły/a';
    if (b !== null && d !== null) return `${b} – ${d}`;
    if (d !== null) return `– ${d}`;
    if (b !== null) return isDeceased ? `${b} – ${word}` : `${b}`;
    return isDeceased ? word : null;
  }

  async list(treeId: string, search: string | undefined, limit: number): Promise<PersonCard[]> {
    const take = Math.min(Math.max(limit, 1), 200);
    if (!search) {
      const rows = await this.indiRepo.find({
        where: { treeId },
        order: { primaryName: 'ASC' },
        take,
      });
      return rows.map((r) => this.toCard(r));
    }
    // Szukaj po nazwisku głównym ORAZ po wariantach w jsonb `names`
    // (po ślubie, panieńskie, aka) — match po pełnej nazwie lub samym nazwisku.
    const rows = await this.indiRepo
      .createQueryBuilder('i')
      .where('i.treeId = :treeId', { treeId })
      .andWhere(
        `(i.primaryName ILIKE :q OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(i.names) n
          WHERE n->>'full' ILIKE :q OR n->>'surname' ILIKE :q OR n->>'given' ILIKE :q
        ))`,
        { q: `%${search}%` },
      )
      .orderBy('i.primaryName', 'ASC')
      .take(take)
      .getMany();
    return rows.map((r) => this.toCard(r));
  }
}
