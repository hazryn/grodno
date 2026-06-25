import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Obiekt medialny (GEDCOM OBJE). W POC trzymamy referencję z GEDCOM (filename).
 * Docelowo pliki w S3/MinIO + generowane miniatury (spec §9).
 */
@Entity('media')
@Index(['treeId', 'xref'], { unique: true })
export class Media {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  treeId: string;

  @Column()
  xref: string;

  @Column({ type: 'varchar', nullable: true })
  title: string | null;

  @Column({ type: 'varchar', nullable: true })
  filename: string | null;

  @Column({ type: 'varchar', nullable: true })
  format: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
