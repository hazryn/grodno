import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../database/entities';

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
}
