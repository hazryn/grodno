import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../database/entities';
import type { UserTokenType } from '../database/entities/user.entity';

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  /** Seed admina przy starcie (idempotentnie) — z ENV SEED_ADMIN_*. */
  async onModuleInit(): Promise<void> {
    const email = process.env.SEED_ADMIN_EMAIL;
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!email || !password) return;
    const existing = await this.repo.findOne({ where: { email } });
    if (existing) return;
    const user = this.repo.create({
      email,
      passwordHash: await bcrypt.hash(password, 10),
      displayName: 'Administrator',
      role: 'admin',
      isActive: true,
      emailVerified: true,
    });
    await this.repo.save(user);
    this.logger.log(`Seed: utworzono konto admina ${email}`);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  create(data: Partial<User>): Promise<User> {
    return this.repo.save(this.repo.create(data));
  }

  save(user: User): Promise<User> {
    return this.repo.save(user);
  }

  /** Konto po hashu jednorazowego tokenu (weryfikacja maila / reset hasła). */
  findByToken(tokenHash: string, type: UserTokenType): Promise<User | null> {
    return this.repo.findOne({ where: { token: tokenHash, tokenType: type } });
  }

  /** Kolejka admina: konta ze zweryfikowanym mailem, czekające na aktywację. */
  listPending(): Promise<User[]> {
    return this.repo.find({
      where: { emailVerified: true, isActive: false },
      order: { createdAt: 'ASC' },
    });
  }

  /** Wszystkie konta (panel admina) — najnowsze najpierw. */
  listAll(): Promise<User[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
