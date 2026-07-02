import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Rola uczestnika w rozmowie (admin = może zarządzać grupą). */
export type ParticipantRole = 'member' | 'admin';

/**
 * Członkostwo użytkownika w rozmowie. Wskaźnik odczytu to `lastReadSeq` (monotoniczny
 * numer wiadomości) — nieprzeczytane = wiadomości innych z `seq > lastReadSeq`.
 * `leftAt` to miękkie opuszczenie grupy (nie kasujemy wiersza — trzyma historię odczytów).
 */
@Entity('conversation_participants')
@Index(['conversationId', 'userId'], { unique: true })
@Index(['userId'])
export class ConversationParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  conversationId: string;

  @Column('uuid')
  userId: string;

  @Column({ type: 'varchar', default: 'member' })
  role: ParticipantRole;

  @CreateDateColumn()
  joinedAt: Date;

  /** Miękkie opuszczenie grupy — filtrujemy `leftAt IS NULL` dla aktywnych. */
  @Column({ type: 'timestamptz', nullable: true })
  leftAt: Date | null;

  /** Ostatni odczytany `seq` (advance-only). bigint → string w JS. */
  @Column({ type: 'bigint', default: 0 })
  lastReadSeq: string;

  @Column({ type: 'uuid', nullable: true })
  lastReadMessageId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastReadAt: Date | null;

  /** Ostatni wysłany digest o nieprzeczytanych (idempotencja crona). */
  @Column({ type: 'timestamptz', nullable: true })
  lastNotifiedAt: Date | null;

  /** Wyciszenie powiadomień do danej chwili. */
  @Column({ type: 'timestamptz', nullable: true })
  mutedUntil: Date | null;
}
