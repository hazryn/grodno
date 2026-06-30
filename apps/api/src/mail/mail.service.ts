import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Wysyłka maili (nodemailer). Wszystko konfigurowalne z ENV (projekt open source):
 * SMTP_*, MAIL_FROM, APP_NAME, FAMILY_NAME, APP_PUBLIC_URL, ADMIN_NOTIFY_EMAIL.
 * Bez SMTP_HOST → tryb dev: zamiast wysyłać, logujemy treść + link do konsoli.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null = this.buildTransporter();

  private buildTransporter(): Transporter | null {
    const host = process.env.SMTP_HOST;
    if (!host) return null;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;
    return nodemailer.createTransport({
      host,
      port: Number.parseInt(process.env.SMTP_PORT ?? '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: user ? { user, pass } : undefined,
    });
  }

  private get appName(): string {
    return process.env.APP_NAME ?? 'Rodno';
  }

  private get familyName(): string {
    return process.env.FAMILY_NAME ?? '';
  }

  /** „drzewo rodziny Szejna" lub fallback bez nazwiska. */
  private get treeLabel(): string {
    return this.familyName ? `drzewo rodziny ${this.familyName}` : `${this.appName} — drzewo rodzinne`;
  }

  private get webBase(): string {
    return (process.env.APP_PUBLIC_URL ?? 'http://localhost:5200').replace(/\/$/, '');
  }

  private get from(): string {
    return process.env.MAIL_FROM ?? `${this.appName} <no-reply@rodno.local>`;
  }

  get adminNotifyAddress(): string | null {
    return process.env.ADMIN_NOTIFY_EMAIL ?? process.env.SEED_ADMIN_EMAIL ?? null;
  }

  confirmLink(token: string): string {
    return `${this.webBase}/auth/confirm?token=${encodeURIComponent(token)}`;
  }

  resetLink(token: string): string {
    return `${this.webBase}/auth/reset?token=${encodeURIComponent(token)}`;
  }

  loginLink(): string {
    return `${this.webBase}/login`;
  }

  /** Link weryfikacyjny po prośbie o dostęp — ustawienie hasła i (jeśli dopasowano) wejście do drzewa. */
  async sendVerify(to: string, token: string): Promise<void> {
    const link = this.confirmLink(token);
    await this.send(
      to,
      `Potwierdź dostęp do ${this.treeLabel}`,
      this.shell(
        'Potwierdź swój adres e-mail',
        `<p>Poproszono o dostęp do <strong>${this.treeLabel}</strong> dla tego adresu.</p>
         <p>Kliknij poniżej, aby potwierdzić e-mail i ustawić hasło.</p>`,
        'Potwierdź i ustaw hasło',
        link,
      ),
    );
  }

  /** Mail do administratora: ktoś poprosił o dostęp, a maila nie ma w drzewie. */
  async sendAdminNewRequest(requester: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  }): Promise<void> {
    const to = this.adminNotifyAddress;
    if (!to) {
      this.logger.warn('Brak ADMIN_NOTIFY_EMAIL — pomijam powiadomienie admina o prośbie o dostęp.');
      return;
    }
    const name = [requester.firstName, requester.lastName].filter(Boolean).join(' ') || '(brak)';
    await this.send(
      to,
      `Nowa prośba o dostęp do ${this.treeLabel}`,
      this.shell(
        'Nowa prośba o dostęp',
        `<p>Osoba spoza drzewa poprosiła o dostęp:</p>
         <p><strong>${name}</strong><br>${requester.email}</p>
         <p>Przypisz ją do osoby w drzewie w panelu administracyjnym, aby aktywować konto.</p>`,
        'Panel administracyjny',
        `${this.webBase}/admin/users`,
      ),
    );
  }

  /** Mail do osoby po przypisaniu jej do osoby w drzewie przez admina. */
  async sendApproved(to: string): Promise<void> {
    await this.send(
      to,
      `Masz już dostęp do ${this.treeLabel}`,
      this.shell(
        'Konto aktywowane',
        `<p>Administrator przyznał Ci dostęp do <strong>${this.treeLabel}</strong>.</p>
         <p>Możesz się już zalogować swoim adresem e-mail i hasłem.</p>`,
        'Zaloguj się',
        this.loginLink(),
      ),
    );
  }

  /** Link do ustawienia nowego hasła. */
  async sendReset(to: string, token: string): Promise<void> {
    const link = this.resetLink(token);
    await this.send(
      to,
      `Reset hasła — ${this.treeLabel}`,
      this.shell(
        'Reset hasła',
        `<p>Otrzymaliśmy prośbę o zmianę hasła do <strong>${this.treeLabel}</strong>.</p>
         <p>Jeśli to nie Ty, zignoruj tę wiadomość.</p>`,
        'Ustaw nowe hasło',
        link,
      ),
    );
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter) {
      // Tryb dev bez SMTP — wypisz treść (z linkiem) do logu, żeby dało się przetestować flow.
      this.logger.log(`[MAIL → ${to}] ${subject}\n${this.stripHtml(html)}`);
      return;
    }
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
    } catch (err) {
      this.logger.error(`Nie udało się wysłać maila do ${to}: ${(err as Error).message}`);
    }
  }

  private shell(title: string, body: string, ctaLabel: string, ctaHref: string): string {
    return `<!doctype html><html lang="pl"><body style="margin:0;background:#f8fafc;font-family:system-ui,sans-serif;color:#1e293b">
      <div style="max-width:520px;margin:0 auto;padding:32px 24px">
        <h1 style="font-size:18px;color:#f59e0b;margin:0 0 16px">${this.appName}</h1>
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px">
          <h2 style="font-size:16px;margin:0 0 12px">${title}</h2>
          <div style="font-size:14px;line-height:1.6">${body}</div>
          <p style="margin:24px 0 0">
            <a href="${ctaHref}" style="display:inline-block;background:#f59e0b;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600">${ctaLabel}</a>
          </p>
          <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">Jeśli przycisk nie działa, skopiuj link: <br>${ctaHref}</p>
        </div>
      </div></body></html>`;
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
