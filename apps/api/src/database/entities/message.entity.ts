import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Generated,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Rodzaj wiadomości: tekst, obraz (załączniki) albo komunikat systemowy. */
export type MessageType = 'text' | 'image' | 'system';

/**
 * Pojedyncza wiadomość. `seq` (BIGSERIAL, globalnie rosnący) jest źródłem prawdy o
 * kolejności i odczytach — NIE `createdAt` (skok zegara / ten sam ms). Cofnięcie = soft
 * delete (`deletedAt`). Komunikaty systemowe trzymają klucz + parametry (lokalizacja u widza).
 */
@Entity('messages')
@Index(['conversationId', 'seq'])
@Index(['senderId'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  conversationId: string;

  /** Monotoniczny numer porządkowy (BIGSERIAL). bigint → string w JS. */
  @Column({ type: 'bigint' })
  @Generated('increment')
  seq: string;

  /** Nadawca (null dla czysto systemowych). */
  @Column({ type: 'uuid', nullable: true })
  senderId: string | null;

  @Column({ type: 'varchar', default: 'text' })
  type: MessageType;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  /** Odpowiedź na wiadomość (opcjonalne cytowanie). */
  @Column({ type: 'uuid', nullable: true })
  replyToId: string | null;

  /** Klucz komunikatu systemowego (np. 'group.created', 'member.added'). */
  @Column({ type: 'varchar', nullable: true })
  systemKind: string | null;

  @Column({ type: 'jsonb', nullable: true })
  systemMeta: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', nullable: true })
  editedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /** Cofnięcie wysłania („unsend"). */
  @DeleteDateColumn()
  deletedAt: Date | null;
}
