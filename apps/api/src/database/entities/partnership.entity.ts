import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { SpouseRelation } from '@rodno/shared';

/**
 * Związek pary (małżeństwo/partnerstwo) — krawędź osoba↔osoba. Nośnik typu związku
 * oraz zdarzeń rodzinnych (MARR, DIV) przez Event.partnershipId. Dzieci NIE wiszą tu —
 * wiszą na krawędziach parent_child (dziecko może mieć rodziców spoza zarejestrowanej pary).
 */
@Entity('partnerships')
@Index(['treeId', 'partnerAId'])
@Index(['treeId', 'partnerBId'])
export class Partnership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  treeId: string;

  /** Partnerzy (kolejność umowna; przy eksporcie A→HUSB-preferencja wg płci). */
  @Column({ type: 'uuid', nullable: true })
  partnerAId: string | null;

  @Column({ type: 'uuid', nullable: true })
  partnerBId: string | null;

  /** married = jest/był ślub; partner = związek bez ślubu. */
  @Column({ type: 'varchar', length: 16, default: 'married' })
  type: SpouseRelation;

  /** Kolejność związków danej osoby (1. małżeństwo, potem kolejne). */
  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
