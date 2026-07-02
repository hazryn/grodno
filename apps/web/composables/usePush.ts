/**
 * Web Push (VAPID) po stronie klienta: rejestracja service workera, subskrypcja i wysłanie
 * jej do API. Bez auto-promptu — `enable()` wołamy z gestu użytkownika. Wszystko client-only.
 */
export function usePush() {
  const config = useRuntimeConfig();
  const api = useApi();
  const vapid = config.public.vapidPublicKey as string;

  function supported(): boolean {
    return (
      import.meta.client &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  function permission(): NotificationPermission | 'unsupported' {
    return supported() ? Notification.permission : 'unsupported';
  }

  async function register(): Promise<ServiceWorkerRegistration | null> {
    if (!supported()) return null;
    try {
      return await navigator.serviceWorker.register('/sw.js');
    } catch {
      return null;
    }
  }

  async function enable(): Promise<boolean> {
    if (!supported() || !vapid) return false;
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return false;
    const reg = (await navigator.serviceWorker.getRegistration()) ?? (await register());
    if (!reg) return false;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid),
    });
    const json = sub.toJSON();
    if (!json.keys?.p256dh || !json.keys?.auth) return false;
    await api.pushSubscribe({
      endpoint: sub.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      userAgent: navigator.userAgent,
    });
    return true;
  }

  async function disable(): Promise<void> {
    if (!supported()) return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await api.pushUnsubscribe(sub.endpoint).catch(() => undefined);
      await sub.unsubscribe().catch(() => undefined);
    }
  }

  /** Klik w notyfikację → SW przekazuje conversationId, otwieramy okno rozmowy. */
  function onNotificationClick(cb: (conversationId: string) => void): void {
    if (!supported()) return;
    navigator.serviceWorker.addEventListener('message', (e: MessageEvent) => {
      const data = e.data as { openConversation?: string } | undefined;
      if (data?.openConversation) cb(data.openConversation);
    });
  }

  return { supported, permission, register, enable, disable, onNotificationClick };
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
