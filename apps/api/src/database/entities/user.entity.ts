import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Użytkownik. Może być powiązany z węzłem Individual (powiadomienia rodziny — faza późn.). */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column()
  displayName: string;

  @Column({ type: 'varchar', default: 'member' })
  role: string;

  @Column({ type: 'uuid', nullable: true })
  individualId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
