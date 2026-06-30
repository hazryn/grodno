import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { GedcomDateValue } from '@rodno/shared';

/**
 * Obiekt medialny. Dwa źródła: import GEDCOM (OBJE → `xref`/`filename`) oraz
 * upload przez UI (galeria/avatar → `storageKey` w MinIO + metadane). Avatar
 * (`isAvatar=true`) jest wykluczany z galerii. Współrzędne oznaczeń osób żyją w `media_tags`.
 */
@Entity('media')
@Index(['treeId', 'xref'], { unique: true, where: '"xref" IS NOT NULL' })
export class Media {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  treeId: string;

  /** Właściciel galerii — osoba, w której galerii zdjęcie się pokazuje (upload). */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  individualId: string | null;

  /** Zdjęcie ślubu — wisi na parze (partnerstwie), nie na osobie. */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  partnershipId: string | null;

  /** xref z GEDCOM (@O1@); null dla zdjęć wgranych przez UI. */
  @Column({ type: 'varchar', nullable: true })
  xref: string | null;

  @Column({ type: 'varchar', nullable: true })
  title: string | null;

  @Column({ type: 'varchar', nullable: true })
  filename: string | null;

  @Column({ type: 'varchar', nullable: true })
  format: string | null;

  /** Goły klucz obiektu w MinIO (np. "gallery/<uuid>.jpg"); MediaService.presign() to obsługuje. */
  @Column({ type: 'varchar', nullable: true })
  storageKey: string | null;

  @Column({ type: 'varchar', nullable: true })
  mimeType: string | null;

  @Column({ type: 'int', nullable: true })
  width: number | null;

  @Column({ type: 'int', nullable: true })
  height: number | null;

  /** Opis zdjęcia. */
  @Column({ type: 'text', nullable: true })
  caption: string | null;

  /** Data wykonania zdjęcia (typ GEDCOM — bywa przybliżona). */
  @Column({ type: 'jsonb', nullable: true })
  takenDate: GedcomDateValue | null;

  /** Ręczna kolejność w galerii (drag-sort). */
  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  /** Avatar — wykluczany z galerii. */
  @Column({ default: false })
  isAvatar: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
