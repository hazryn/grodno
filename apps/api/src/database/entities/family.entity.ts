import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Rodzina/unia — węzeł relacji (NIE krawędzie osoba-osoba, p. spec §12).
 * Para (mąż/żona/partnerzy) + dzieci (przez FamilyChild).
 */
@Entity('families')
@Index(['treeId', 'xref'], { unique: true })
export class Family {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  treeId: string;

  @Column()
  xref: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  husbandId: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  wifeId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
