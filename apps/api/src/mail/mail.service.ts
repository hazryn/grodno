import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import {
  adminNewRequestCopy,
  approvedCopy,
  mailFallbackHint,
  mailTreeLabel,
  normalizeMailLocale,
  resetCopy,
  unreadDigestCopy,
  verifyCopy,
  type MailCopy,
  type MailLocale,
} from './i18n';

/**
 * Wysyłka maili (nodemailer). Wszystko konfigurowalne z ENV (projekt open source):
 * SMTP_*, MAIL_FROM, APP_NAME, FAMILY_NAME, APP_PUBLIC_URL, ADMIN_NOTIFY_EMAIL, DEFAULT_LOCALE.
 * Treści w 3 językach (mail/i18n.ts); linki niosą prefiks języka (/pl, /en, /de).
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

  private get webBase(): string {
    return (process.env.APP_PUBLIC_URL ?? 'http://localhost:5200').replace(/\/$/, '');
  }

  private get from(): string {
    return process.env.MAIL_FROM ?? `${this.appName} <no-reply@rodno.local>`;
  }

  private get adminLocale(): MailLocale {
    return normalizeMailLocale(process.env.DEFAULT_LOCALE);
  }

  get adminNotifyAddress(): string | null {
    return process.env.ADMIN_NOTIFY_EMAIL ?? process.env.SEED_ADMIN_EMAIL ?? null;
  }

  private treeLabel(locale: MailLocale): string {
    return mailTreeLabel(locale, this.familyName, this.appName);
  }

  confirmLink(token: string, locale: MailLocale): string {
    return `${this.webBase}/${locale}/auth/confirm?token=${encodeURIComponent(token)}`;
  }

  resetLink(token: string, locale: MailLocale): string {
    return `${this.webBase}/${locale}/auth/reset?token=${encodeURIComponent(token)}`;
  }

  loginLink(locale: MailLocale): string {
    return `${this.webBase}/${locale}/login`;
  }

  chatLink(locale: MailLocale): string {
    return `${this.webBase}/${locale}/chat`;
  }

  /** Link weryfikacyjny po prośbie o dostęp — ustawienie hasła i (jeśli dopasowano) wejście do drzewa. */
  async sendVerify(to: string, token: string, locale: string): Promise<void> {
    const l = normalizeMailLocale(locale);
    const copy = verifyCopy(l, this.treeLabel(l));
    await this.deliver(to, copy, this.confirmLink(token, l), l);
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
    const l = this.adminLocale;
    const name = [requester.firstName, requester.lastName].filter(Boolean).join(' ') || '(brak)';
    const copy = adminNewRequestCopy(l, this.treeLabel(l), name, requester.email);
    await this.deliver(to, copy, `${this.webBase}/${l}/admin/users`, l);
  }

  /** Mail do osoby po przypisaniu jej do osoby w drzewie przez admina. */
  async sendApproved(to: string, locale: string): Promise<void> {
    const l = normalizeMailLocale(locale);
    const copy = approvedCopy(l, this.treeLabel(l));
    await this.deliver(to, copy, this.loginLink(l), l);
  }

  /** Przypomnienie o nieprzeczytanych wiadomościach czatu (cron po N dniach). */
  async sendUnreadDigest(to: string, locale: string, count: number): Promise<void> {
    const l = normalizeMailLocale(locale);
    const copy = unreadDigestCopy(l, this.treeLabel(l), count);
    await this.deliver(to, copy, this.chatLink(l), l);
  }

  /** Link do ustawienia nowego hasła. */
  async sendReset(to: string, token: string, locale: string): Promise<void> {
    const l = normalizeMailLocale(locale);
    const copy = resetCopy(l, this.treeLabel(l));
    await this.deliver(to, copy, this.resetLink(token, l), l);
  }

  private async deliver(to: string, copy: MailCopy, ctaHref: string, locale: MailLocale): Promise<void> {
    const html = this.shell(copy, ctaHref, locale);
    if (!this.transporter) {
      // Tryb dev bez SMTP — wypisz treść (z linkiem) do logu, żeby dało się przetestować flow.
      this.logger.log(`[MAIL → ${to}] ${copy.subject}\n${this.stripHtml(html)}`);
      return;
    }
    try {
      await this.transporter.sendMail({ from: this.from, to, subject: copy.subject, html });
    } catch (err) {
      this.logger.error(`Nie udało się wysłać maila do ${to}: ${(err as Error).message}`);
    }
  }

  private shell(copy: MailCopy, ctaHref: string, locale: MailLocale): string {
    return `<!doctype html><html lang="${locale}"><body style="margin:0;background:#f8fafc;font-family:system-ui,sans-serif;color:#1e293b">
      <div style="max-width:520px;margin:0 auto;padding:32px 24px">
        <h1 style="font-size:18px;color:#f59e0b;margin:0 0 16px">${this.appName}</h1>
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px">
          <h2 style="font-size:16px;margin:0 0 12px">${copy.title}</h2>
          <div style="font-size:14px;line-height:1.6">${copy.body}</div>
          <p style="margin:24px 0 0">
            <a href="${ctaHref}" style="display:inline-block;background:#f59e0b;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600">${copy.cta}</a>
          </p>
          <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">${mailFallbackHint[locale]} <br>${ctaHref}</p>
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
