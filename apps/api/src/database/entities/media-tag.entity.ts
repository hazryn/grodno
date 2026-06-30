import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Oznaczenie osoby na zdjęciu ("kwadracik"). Współrzędne znormalizowane 0..1
 * (niezależne od rozmiaru renderu). `individualId` klikalny → profil; `name` to
 * fallback, gdy osoby nie ma w drzewie.
 */
@Entity('media_tags')
export class MediaTag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  treeId: string;

  @Index()
  @Column('uuid')
  mediaId: string;

  @Column({ type: 'uuid', nullable: true })
  individualId: string | null;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({ type: 'double precision' })
  x: number;

  @Column({ type: 'double precision' })
  y: number;

  @Column({ type: 'double precision' })
  w: number;

  @Column({ type: 'double precision' })
  h: number;

  @CreateDateColumn()
  createdAt: Date;
}
