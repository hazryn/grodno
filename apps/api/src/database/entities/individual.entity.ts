import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { GedcomDateValue, PersonName, Sex } from '@rodno/shared';

/**
 * Osoba. Pola zdarzeń urodzenia/śmierci są zdenormalizowane (rok, miejsce, foto)
 * — bundle drzewa czyta kafelek z jednego wiersza, bez N+1. Pełna oś czasu żyje
 * w `events`. Flagi grafu (hasParents/childCount) liczone przy imporcie.
 */
@Entity('individuals')
@Index(['treeId', 'xref'], { unique: true })
export class Individual {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  treeId: string;

  /** Oryginalny xref z GEDCOM, np. "I500001" (round-trip + debug). */
  @Column()
  xref: string;

  @Column({ type: 'varchar', length: 1, default: 'U' })
  sex: Sex;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  names: PersonName[];

  @Column()
  primaryName: string;

  /** Prywatność — ukrywanie danych osób żyjących dla niezalogowanych. */
  @Column({ default: false })
  isLiving: boolean;

  /** Czy WIEMY, że osoba zmarła (jest DEAT albo bardzo dawne urodzenie). Różne od !isLiving. */
  @Column({ default: false })
  deceased: boolean;

  @Column({ type: 'jsonb', nullable: true })
  birthDate: GedcomDateValue | null;

  @Column({ type: 'int', nullable: true })
  birthYear: number | null;

  @Column({ type: 'uuid', nullable: true })
  birthPlaceId: string | null;

  @Column({ type: 'varchar', nullable: true })
  birthPlaceTown: string | null;

  @Column({ type: 'varchar', nullable: true })
  birthPlaceFull: string | null;

  @Column({ type: 'jsonb', nullable: true })
  deathDate: GedcomDateValue | null;

  @Column({ type: 'int', nullable: true })
  deathYear: number | null;

  @Column({ type: 'uuid', nullable: true })
  deathPlaceId: string | null;

  @Column({ type: 'varchar', nullable: true })
  lifespan: string | null;

  @Column({ type: 'uuid', nullable: true })
  photoMediaId: string | null;

  @Column({ type: 'varchar', nullable: true })
  photoUrl: string | null;

  /** Zdenormalizowane flagi grafu do przycisków +/− w drzewie. */
  @Column({ default: false })
  hasParents: boolean;

  @Column({ type: 'int', default: 0 })
  childCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
