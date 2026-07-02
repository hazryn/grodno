import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Reakcja emoji na wiadomość. Jeden (wiadomość, użytkownik, emoji) = jeden wiersz. */
@Entity('message_reactions')
@Index(['messageId', 'userId', 'emoji'], { unique: true })
@Index(['messageId'])
export class MessageReaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  messageId: string;

  @Column('uuid')
  userId: string;

  @Column({ type: 'varchar', length: 16 })
  emoji: string;

  @CreateDateColumn()
  createdAt: Date;
}
