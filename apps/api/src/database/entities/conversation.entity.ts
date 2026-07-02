import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Rozmowa: bezpośrednia 1:1 albo grupowa. */
export type ConversationType = 'direct' | 'group';

/**
 * Kontener rozmowy. Zakres = drzewo (multi-tenant przez `treeId`, wyznaczane serwerowo
 * z osoby twórcy — User nie ma treeId). Unikalność 1:1 pilnuje częściowy indeks unikalny
 * na (treeId, directKey), gdzie directKey = posortowane id uczestników "a:b" (null dla grup).
 */
@Entity('conversations')
@Index(['treeId', 'directKey'], {
  unique: true,
  where: `"type" = 'direct' AND "directKey" IS NOT NULL`,
})
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  treeId: string;

  @Column({ type: 'varchar', default: 'direct' })
  type: ConversationType;

  /** Nazwa grupy (null dla 1:1). */
  @Column({ type: 'varchar', nullable: true })
  title: string | null;

  /** Awatar grupy — goły klucz MinIO (render przez MediaService.presign). */
  @Column({ type: 'varchar', nullable: true })
  storageKey: string | null;

  @Column({ type: 'uuid' })
  createdBy: string;

  /** Kanoniczny klucz 1:1 = posortowane userId "a:b"; null dla grup. */
  @Column({ type: 'varchar', nullable: true })
  directKey: string | null;

  /** Zdenormalizowane pod listę rozmów (sort malejąco). */
  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  lastMessageId: string | null;

  /** Podgląd ostatniej wiadomości (cache — przeliczany przy edycji/cofnięciu). */
  @Column({ type: 'varchar', length: 160, nullable: true })
  lastMessagePreview: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
