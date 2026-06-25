import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { PedigreeType } from '@rodno/shared';

/** Powiązanie dziecko ↔ rodzina (GEDCOM CHIL/FAMC), z kolejnością i typem (PEDI). */
@Entity('family_children')
@Index(['familyId', 'childId'], { unique: true })
export class FamilyChild {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  treeId: string;

  @Index()
  @Column('uuid')
  familyId: string;

  @Index()
  @Column('uuid')
  childId: string;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'varchar', default: 'birth' })
  pedigree: PedigreeType;
}
