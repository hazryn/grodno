import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Subskrypcja Web Push (VAPID) — jedna na urządzenie/przeglądarkę. `endpoint` unikalny;
 * martwe subskrypcje (404/410 przy wysyłce) usuwamy.
 */
@Entity('push_subscriptions')
@Index(['userId'])
export class PushSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @Column({ type: 'varchar', unique: true })
  endpoint: string;

  @Column({ type: 'varchar' })
  p256dh: string;

  @Column({ type: 'varchar' })
  auth: string;

  @Column({ type: 'varchar', nullable: true })
  userAgent: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;
}
