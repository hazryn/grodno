import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Drzewo genealogiczne — jednostka multi-tenant (jak companyId w innych projektach). */
@Entity('trees')
export class Tree {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true, type: 'varchar' })
  title: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
