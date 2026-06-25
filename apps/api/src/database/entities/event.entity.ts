import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { EventOwnerType, GedcomDateValue } from '@rodno/shared';

/**
 * Zdarzenie/fakt — wspólne dla osób i rodzin (spec §4). Data to typ GEDCOM
 * (jsonb), nie goły Date. `sortKey` (YYYYMMDD) do chronologicznej osi czasu.
 */
@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  treeId: string;

  @Column({ type: 'varchar' })
  ownerType: EventOwnerType;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  individualId: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  familyId: string | null;

  /** Tag GEDCOM: BIRT, DEAT, MARR, DIV, RESI, OCCU, EVEN, ... */
  @Column()
  type: string;

  @Column({ type: 'jsonb', nullable: true })
  date: GedcomDateValue | null;

  /** YYYYMMDD do sortowania; null gdy brak roku (mieści się w int4). */
  @Column({ type: 'int', nullable: true })
  sortKey: number | null;

  @Column({ type: 'uuid', nullable: true })
  placeId: string | null;

  @Column({ type: 'varchar', nullable: true })
  placeName: string | null;

  @Column({ type: 'text', nullable: true })
  value: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
