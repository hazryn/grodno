import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { Individual, User } from '../database/entities';
import type { UserTokenType } from '../database/entities/user.entity';
import { AuthService, type LoginResult } from '../auth/auth.service';
import { UsersService } from '../auth/users.service';
import { MailService } from '../mail/mail.service';

export interface PendingUserDto {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  createdAt: Date;
}

export type ConfirmResult =
  | ({ status: 'approved' } & LoginResult)
  | { status: 'pending_admin' };

@Injectable()
export class AccessService {
  private readonly logger = new Logger(AccessService.name);

  constructor(
    @InjectRepository(Individual) private readonly individuals: Repository<Individual>,
    private readonly users: UsersService,
    private readonly auth: AuthService,
    private readonly mail: MailService,
  ) {}

  /* --------------------------------- prośba o dostęp --------------------------------- */

  /** Zawsze zwraca to samo (nie zdradzamy, czy e-mail istnieje). */
  async request(
    firstName: string,
    lastName: string,
    email: string,
    locale: string,
  ): Promise<{ ok: true }> {
    const normalized = this.normalizeEmail(email);
    const existing = await this.users.findByEmail(normalized);

    if (existing?.isActive) {
      // Konto już ma dostęp → wyślij link do ustawienia/zmiany hasła (odzysk konta).
      const token = await this.assignToken(existing, 'reset');
      await this.mail.sendReset(normalized, token, existing.locale);
      return { ok: true };
    }

    if (existing) {
      // Konto istnieje, ale nieaktywne/niezweryfikowane → ponów link weryfikacyjny.
      existing.firstName = existing.firstName ?? this.clean(firstName);
      existing.lastName = existing.lastName ?? this.clean(lastName);
      existing.locale = locale;
      const token = await this.assignToken(existing, 'verify');
      await this.mail.sendVerify(normalized, token, locale);
      return { ok: true };
    }

    // Nowe konto „pending" — hasło ustawi przy potwierdzeniu.
    const user = await this.users.create({
      email: normalized,
      passwordHash: null,
      firstName: this.clean(firstName),
      lastName: this.clean(lastName),
      displayName: this.displayName(firstName, lastName, normalized),
      role: 'member',
      isActive: false,
      emailVerified: false,
      locale,
    });
    const token = await this.assignToken(user, 'verify');
    await this.mail.sendVerify(normalized, token, locale);
    return { ok: true };
  }

  /* --------------------------------- potwierdzenie + hasło --------------------------------- */

  async confirm(token: string, password: string): Promise<ConfirmResult> {
    const user = await this.consumeToken(token, 'verify');
    user.passwordHash = await bcrypt.hash(password, 10);
    user.emailVerified = true;

    // Dopasowanie: admin prelinkował osobę LUB e-mail figuruje przy osobie w drzewie.
    if (!user.individualId) {
      const match = await this.findIndividualByEmail(user.email);
      if (match) user.individualId = match.id;
    }

    if (user.individualId) {
      user.isActive = true;
      const saved = await this.users.save(user);
      return { status: 'approved', ...this.auth.issue(saved) };
    }

    await this.users.save(user);
    await this.mail.sendAdminNewRequest({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    });
    return { status: 'pending_admin' };
  }

  /* --------------------------------- reset hasła --------------------------------- */

  async forgot(email: string): Promise<{ ok: true }> {
    const normalized = this.normalizeEmail(email);
    const user = await this.users.findByEmail(normalized);
    if (user) {
      const token = await this.assignToken(user, 'reset');
      await this.mail.sendReset(normalized, token, user.locale);
    }
    return { ok: true };
  }

  async reset(token: string, password: string): Promise<ConfirmResult> {
    const user = await this.consumeToken(token, 'reset');
    user.passwordHash = await bcrypt.hash(password, 10);
    user.emailVerified = true;
    const saved = await this.users.save(user);
    return saved.isActive
      ? { status: 'approved', ...this.auth.issue(saved) }
      : { status: 'pending_admin' };
  }

  /* --------------------------------- panel admina --------------------------------- */

  async listPending(): Promise<PendingUserDto[]> {
    const users = await this.users.listPending();
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      displayName: u.displayName,
      createdAt: u.createdAt,
    }));
  }

  /** Przypisanie konta do osoby w drzewie → aktywacja + mail „możesz się zalogować". */
  async assignIndividual(userId: string, individualId: string): Promise<PendingUserDto> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('Konto nie istnieje');
    const individual = await this.individuals.findOne({ where: { id: individualId } });
    if (!individual) throw new NotFoundException('Osoba nie istnieje');

    user.individualId = individual.id;
    user.isActive = true;
    const saved = await this.users.save(user);
    await this.mail.sendApproved(saved.email, saved.locale);
    return {
      id: saved.id,
      email: saved.email,
      firstName: saved.firstName,
      lastName: saved.lastName,
      displayName: saved.displayName,
      createdAt: saved.createdAt,
    };
  }

  /* --------------------------------- helpers --------------------------------- */

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private clean(value: string): string | null {
    const v = value?.trim();
    return v ? v : null;
  }

  private displayName(firstName: string, lastName: string, email: string): string {
    return [this.clean(firstName), this.clean(lastName)].filter(Boolean).join(' ') || email;
  }

  /** Wygeneruj token, zapisz jego hash na koncie, zwróć surowy (do linku w mailu). */
  private async assignToken(user: User, type: UserTokenType): Promise<string> {
    const raw = randomBytes(32).toString('hex');
    user.token = this.hash(raw);
    user.tokenType = type;
    user.tokenExpiresAt = new Date(Date.now() + this.ttlMs());
    await this.users.save(user);
    return raw;
  }

  /** Znajdź konto po surowym tokenie, sprawdź ważność, wyzeruj slot (jednorazowość). */
  private async consumeToken(raw: string, type: UserTokenType): Promise<User> {
    const user = await this.users.findByToken(this.hash(raw), type);
    if (!user || !user.tokenExpiresAt || user.tokenExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Link jest nieprawidłowy lub wygasł.');
    }
    user.token = null;
    user.tokenType = null;
    user.tokenExpiresAt = null;
    return user;
  }

  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private ttlMs(): number {
    const hours = Number.parseInt(process.env.TOKEN_TTL_HOURS ?? '24', 10);
    return (Number.isFinite(hours) ? hours : 24) * 3600_000;
  }

  /** Osoba w drzewie z danym e-mailem (case-insensitive, w tablicy JSONB emails). */
  private findIndividualByEmail(email: string): Promise<Individual | null> {
    return this.individuals
      .createQueryBuilder('i')
      .where('i.deletedAt IS NULL')
      .andWhere(
        `EXISTS (SELECT 1 FROM jsonb_array_elements_text(i.emails) AS e WHERE lower(e) = :email)`,
        { email: email.toLowerCase() },
      )
      .getOne();
  }
}
