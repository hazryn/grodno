import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { EventParticipantRole } from '@rodno/shared';

/**
 * Uczestnik zdarzenia — powiązanie osoba↔osoba (np. chrzestni przy chrzcie,
 * świadkowie przy ślubie). `individualId` klikalny → profil; `name` to fallback
 * tekstowy, gdy osoby nie ma w drzewie.
 */
@Entity('event_participants')
export class EventParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  treeId: string;

  @Index()
  @Column('uuid')
  eventId: string;

  @Column({ type: 'uuid', nullable: true })
  individualId: string | null;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({ type: 'varchar', default: 'other' })
  role: EventParticipantRole;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;
}
