import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { createHash, randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { formatPersonName, normalizeLocale, type Locale, type Sex } from '@rodno/shared';
import { Individual, User } from '../database/entities';
import type { UserTokenType } from '../database/entities/user.entity';
import { AuthService, type LoginResult } from '../auth/auth.service';
import { UsersService } from '../auth/users.service';
import { MailService } from '../mail/mail.service';
import { MediaService } from '../media/media.service';

export interface PendingUserDto {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  createdAt: Date;
}

/** Osoba w drzewie powiązana z kontem (widok w panelu admina). */
export interface AdminUserPersonDto {
  id: string;
  name: string;
  photoUrl: string | null;
  sex: Sex;
  isLiving: boolean;
  treeId: string;
}

/** Konto w panelu admina — zaproszone i aktywne (łącznie z powiązaną osobą). */
export interface AdminUserDto {
  id: string;
  email: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  locale: string;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: Date;
  /** 'active' — ma dostęp; 'pending' — potwierdził mail, czeka na przypisanie; 'invited' — jeszcze nie potwierdził. */
  status: 'active' | 'pending' | 'invited';
  individualId: string | null;
  person: AdminUserPersonDto | null;
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
    private readonly media: MediaService,
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

  /** Wszystkie konta (zaproszone + aktywne) z powiązaną osobą — panel admina. */
  async listAllUsers(locale: Locale = 'pl'): Promise<AdminUserDto[]> {
    const users = await this.users.listAll();
    const indiIds = [
      ...new Set(users.map((u) => u.individualId).filter((x): x is string => !!x)),
    ];
    const indis = indiIds.length
      ? await this.individuals.find({ where: { id: In(indiIds) } })
      : [];
    const byId = new Map(indis.map((i) => [i.id, i]));
    return users.map((u) => this.toAdminUserDto(u, byId, locale));
  }

  private toAdminUserDto(u: User, byId: Map<string, Individual>, locale: Locale): AdminUserDto {
    const indi = u.individualId ? byId.get(u.individualId) : null;
    const status: AdminUserDto['status'] = u.isActive
      ? 'active'
      : u.emailVerified
        ? 'pending'
        : 'invited';
    return {
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      locale: u.locale,
      isActive: u.isActive,
      emailVerified: u.emailVerified,
      createdAt: u.createdAt,
      status,
      individualId: u.individualId,
      person: indi
        ? {
            id: indi.id,
            name: formatPersonName(indi.names, locale) || indi.primaryName,
            photoUrl: this.media.presign(indi.photoUrl),
            sex: indi.sex,
            isLiving: indi.isLiving,
            treeId: indi.treeId,
          }
        : null,
    };
  }

  /**
   * Przypisanie/zmiana osoby powiązanej z kontem. Pierwsza aktywacja (konto było nieaktywne)
   * wysyła mail „możesz się zalogować"; sama zmiana osoby na aktywnym koncie — bez maila.
   */
  async assignIndividual(
    userId: string,
    individualId: string,
    locale: Locale = 'pl',
  ): Promise<AdminUserDto> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('Konto nie istnieje');
    const individual = await this.individuals.findOne({ where: { id: individualId } });
    if (!individual) throw new NotFoundException('Osoba nie istnieje');

    const wasInactive = !user.isActive;
    user.individualId = individual.id;
    user.isActive = true;
    const saved = await this.users.save(user);
    if (wasInactive) await this.mail.sendApproved(saved.email, saved.locale);
    return this.toAdminUserDto(saved, new Map([[individual.id, individual]]), locale);
  }

  /** Usunięcie konta (admin). Nie można usunąć własnego. Członkostwa/reakcje/push kaskadują (FK). */
  async deleteUser(userId: string, requesterId: string): Promise<void> {
    if (userId === requesterId) {
      throw new BadRequestException('Nie można usunąć własnego konta.');
    }
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('Konto nie istnieje');
    await this.users.delete(userId);
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
