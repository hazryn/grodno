import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Cache tłumaczenia wiadomości. Klucz (messageId, targetLocale) + `sourceHash` (sha256 body):
 * trafienie tylko gdy hash zgodny → edycja treści automatycznie unieważnia cache.
 */
@Entity('message_translations')
@Index(['messageId', 'targetLocale'], { unique: true })
@Index(['messageId'])
export class MessageTranslation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  messageId: string;

  @Column({ type: 'varchar' })
  targetLocale: string;

  @Column({ type: 'varchar', nullable: true })
  sourceLocale: string | null;

  /** sha256 tłumaczonego body — wykrywa nieaktualny cache po edycji. */
  @Column({ type: 'varchar' })
  sourceHash: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'varchar', nullable: true })
  provider: string | null;

  @Column({ type: 'varchar', nullable: true })
  model: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
