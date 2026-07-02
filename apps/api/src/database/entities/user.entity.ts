import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Jednorazowy token: weryfikacja maila (onboarding) lub reset hasła. */
export type UserTokenType = 'verify' | 'reset';

/** Użytkownik. Może być powiązany z węzłem Individual (centrowanie drzewa „na sobie"). */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  /** Null aż do onboardingu (ustawienia hasła po kliknięciu linku). */
  @Column({ type: 'varchar', nullable: true })
  passwordHash: string | null;

  @Column()
  displayName: string;

  @Column({ type: 'varchar', nullable: true })
  firstName: string | null;

  @Column({ type: 'varchar', nullable: true })
  lastName: string | null;

  @Column({ type: 'varchar', default: 'member' })
  role: string;

  /** Preferowany język interfejsu i powiadomień e-mail (pl|en|de). */
  @Column({ type: 'varchar', default: 'pl' })
  locale: string;

  /** Brama dostępu: login i odczyt drzewa tylko dla aktywnych (po dopasowaniu/akceptacji admina). */
  @Column({ default: false })
  isActive: boolean;

  /** Czy mail potwierdzony klikiem w link weryfikacyjny. */
  @Column({ default: false })
  emailVerified: boolean;

  @Column({ type: 'uuid', nullable: true })
  individualId: string | null;

  /** Hash jednorazowego tokenu (verify/reset) — nigdy plaintext. */
  @Column({ type: 'varchar', nullable: true })
  token: string | null;

  @Column({ type: 'varchar', nullable: true })
  tokenType: UserTokenType | null;

  @Column({ type: 'timestamptz', nullable: true })
  tokenExpiresAt: Date | null;

  /** Ostatnia aktywność (obecność w czacie). „Online" trzymamy w pamięci gateway'a. */
  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
