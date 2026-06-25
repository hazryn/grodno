import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Źródło (GEDCOM SOUR). Proste: tytuł + autor + tekst (spec §12 — bez GPS). */
@Entity('sources')
@Index(['treeId', 'xref'], { unique: true })
export class Source {
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
  author: string | null;

  @Column({ type: 'text', nullable: true })
  text: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
