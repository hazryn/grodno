import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Załącznik (zdjęcie) wiadomości w MinIO. Wgrywany osobno (rekord „pending" bez messageId),
 * a `message:send` go „claimuje" po id — po weryfikacji, że należy do nadawcy i rozmowy.
 * `storageKey` = goły klucz `chat/<conversationId>/<uuid>.<ext>` (render przez presign).
 */
@Entity('message_attachments')
@Index(['messageId'])
export class MessageAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** null aż do podpięcia pod wiadomość (upload → send). */
  @Column({ type: 'uuid', nullable: true })
  messageId: string | null;

  @Column('uuid')
  conversationId: string;

  @Column('uuid')
  uploadedBy: string;

  @Column({ type: 'varchar' })
  storageKey: string;

  @Column({ type: 'varchar' })
  mimeType: string;

  @Column({ type: 'int', nullable: true })
  width: number | null;

  @Column({ type: 'int', nullable: true })
  height: number | null;

  /** Rozmiar w bajtach. */
  @Column({ type: 'int', nullable: true })
  size: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
