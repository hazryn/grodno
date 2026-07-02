/** Treści maili w 3 językach (pl|en|de). Linki/HTML składa MailService. */
export type MailLocale = 'pl' | 'en' | 'de';

export function normalizeMailLocale(value: string | null | undefined): MailLocale {
  return value === 'en' || value === 'de' ? value : 'pl';
}

export interface MailCopy {
  subject: string;
  title: string;
  body: string;
  cta: string;
}

/** Nazwa drzewa w mailu (z nazwą rodziny lub fallback z nazwą aplikacji). */
export function mailTreeLabel(locale: MailLocale, family: string, appName: string): string {
  if (family) {
    if (locale === 'en') return `the ${family} family tree`;
    if (locale === 'de') return `dem Stammbaum der Familie ${family}`;
    return `drzewo rodziny ${family}`;
  }
  if (locale === 'en') return `${appName} — family tree`;
  if (locale === 'de') return `dem Familienstammbaum (${appName})`;
  return `${appName} — drzewo rodzinne`;
}

export const mailFallbackHint: Record<MailLocale, string> = {
  pl: 'Jeśli przycisk nie działa, skopiuj link:',
  en: "If the button doesn't work, copy the link:",
  de: 'Falls der Button nicht funktioniert, kopiere den Link:',
};

export function verifyCopy(locale: MailLocale, tree: string): MailCopy {
  if (locale === 'en')
    return {
      subject: `Confirm access to ${tree}`,
      title: 'Confirm your e-mail address',
      body: `<p>Access to <strong>${tree}</strong> was requested for this address.</p><p>Click below to confirm your e-mail and set a password.</p>`,
      cta: 'Confirm and set password',
    };
  if (locale === 'de')
    return {
      subject: `Zugang zu ${tree} bestätigen`,
      title: 'Bestätige deine E-Mail-Adresse',
      body: `<p>Für diese Adresse wurde Zugang zu <strong>${tree}</strong> angefragt.</p><p>Klicke unten, um deine E-Mail zu bestätigen und ein Passwort festzulegen.</p>`,
      cta: 'Bestätigen und Passwort festlegen',
    };
  return {
    subject: `Potwierdź dostęp do ${tree}`,
    title: 'Potwierdź swój adres e-mail',
    body: `<p>Poproszono o dostęp do <strong>${tree}</strong> dla tego adresu.</p><p>Kliknij poniżej, aby potwierdzić e-mail i ustawić hasło.</p>`,
    cta: 'Potwierdź i ustaw hasło',
  };
}

export function adminNewRequestCopy(
  locale: MailLocale,
  tree: string,
  name: string,
  email: string,
): MailCopy {
  if (locale === 'en')
    return {
      subject: `New access request for ${tree}`,
      title: 'New access request',
      body: `<p>Someone outside the tree requested access:</p><p><strong>${name}</strong><br>${email}</p><p>Link them to a person in the tree from the admin panel to activate the account.</p>`,
      cta: 'Admin panel',
    };
  if (locale === 'de')
    return {
      subject: `Neue Zugangsanfrage für ${tree}`,
      title: 'Neue Zugangsanfrage',
      body: `<p>Jemand außerhalb des Stammbaums hat Zugang angefragt:</p><p><strong>${name}</strong><br>${email}</p><p>Verknüpfe die Person im Admin-Bereich mit einer Person im Stammbaum, um das Konto zu aktivieren.</p>`,
      cta: 'Admin-Bereich',
    };
  return {
    subject: `Nowa prośba o dostęp do ${tree}`,
    title: 'Nowa prośba o dostęp',
    body: `<p>Osoba spoza drzewa poprosiła o dostęp:</p><p><strong>${name}</strong><br>${email}</p><p>Przypisz ją do osoby w drzewie w panelu administracyjnym, aby aktywować konto.</p>`,
    cta: 'Panel administracyjny',
  };
}

export function approvedCopy(locale: MailLocale, tree: string): MailCopy {
  if (locale === 'en')
    return {
      subject: `You now have access to ${tree}`,
      title: 'Account activated',
      body: `<p>An administrator granted you access to <strong>${tree}</strong>.</p><p>You can now log in with your e-mail and password.</p>`,
      cta: 'Log in',
    };
  if (locale === 'de')
    return {
      subject: `Du hast jetzt Zugang zu ${tree}`,
      title: 'Konto aktiviert',
      body: `<p>Ein Administrator hat dir Zugang zu <strong>${tree}</strong> gewährt.</p><p>Du kannst dich jetzt mit deiner E-Mail und deinem Passwort anmelden.</p>`,
      cta: 'Anmelden',
    };
  return {
    subject: `Masz już dostęp do ${tree}`,
    title: 'Konto aktywowane',
    body: `<p>Administrator przyznał Ci dostęp do <strong>${tree}</strong>.</p><p>Możesz się już zalogować swoim adresem e-mail i hasłem.</p>`,
    cta: 'Zaloguj się',
  };
}

export function unreadDigestCopy(locale: MailLocale, tree: string, count: number): MailCopy {
  if (locale === 'en')
    return {
      subject: `You have unread messages in ${tree}`,
      title: 'New messages waiting',
      body: `<p>You have unread messages in <strong>${tree}</strong> across ${count} conversation(s).</p><p>Open the chat to read and reply.</p>`,
      cta: 'Open chat',
    };
  if (locale === 'de')
    return {
      subject: `Ungelesene Nachrichten in ${tree}`,
      title: 'Neue Nachrichten warten',
      body: `<p>Du hast ungelesene Nachrichten in <strong>${tree}</strong> in ${count} Unterhaltung(en).</p><p>Öffne den Chat, um zu lesen und zu antworten.</p>`,
      cta: 'Chat öffnen',
    };
  return {
    subject: `Masz nieprzeczytane wiadomości w ${tree}`,
    title: 'Czekają nowe wiadomości',
    body: `<p>Masz nieprzeczytane wiadomości w <strong>${tree}</strong> w ${count} rozmow(ach).</p><p>Otwórz czat, aby przeczytać i odpisać.</p>`,
    cta: 'Otwórz czat',
  };
}

export function resetCopy(locale: MailLocale, tree: string): MailCopy {
  if (locale === 'en')
    return {
      subject: `Password reset — ${tree}`,
      title: 'Password reset',
      body: `<p>We received a request to change the password for <strong>${tree}</strong>.</p><p>If this wasn't you, ignore this message.</p>`,
      cta: 'Set a new password',
    };
  if (locale === 'de')
    return {
      subject: `Passwort zurücksetzen — ${tree}`,
      title: 'Passwort zurücksetzen',
      body: `<p>Wir haben eine Anfrage zur Änderung des Passworts für <strong>${tree}</strong> erhalten.</p><p>Falls du das nicht warst, ignoriere diese Nachricht.</p>`,
      cta: 'Neues Passwort festlegen',
    };
  return {
    subject: `Reset hasła — ${tree}`,
    title: 'Reset hasła',
    body: `<p>Otrzymaliśmy prośbę o zmianę hasła do <strong>${tree}</strong>.</p><p>Jeśli to nie Ty, zignoruj tę wiadomość.</p>`,
    cta: 'Ustaw nowe hasło',
  };
}
