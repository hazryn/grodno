import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { PedigreeType } from '@rodno/shared';

/**
 * Krawędź rodzic→dziecko (model bezpośrednich relacji osoba↔osoba — DB jest źródłem
 * prawdy, GEDCOM tylko import/eksport). Dziecko ma zwykle 2 takie krawędzie (ojciec, matka).
 * Zastępuje GEDCOM-owy węzeł Family + FamilyChild.
 */
@Entity('parent_child')
@Index(['treeId', 'childId'])
@Index(['treeId', 'parentId'])
@Index(['parentId', 'childId'], { unique: true })
export class ParentChild {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  treeId: string;

  @Column('uuid')
  parentId: string;

  @Column('uuid')
  childId: string;

  /** Rola rodzica — do odtworzenia HUSB/WIFE przy eksporcie GED i kolorów w UI. */
  @Column({ type: 'varchar', length: 8, default: 'parent' })
  parentRole: 'father' | 'mother' | 'parent';

  /** Typ pokrewieństwa (GEDCOM PEDI): birth/adopted/foster/... */
  @Column({ type: 'varchar', default: 'birth' })
  pedigree: PedigreeType;

  /** Kolejność dziecka wśród rodzeństwa (z jednej pary). */
  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;
}
