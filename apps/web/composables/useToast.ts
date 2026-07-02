/** Globalne toasty aplikacji (zamiast window.alert). Host: components/common/Toaster.vue. */
export interface ToastItem {
  id: number;
  message: string;
  kind: 'info' | 'success' | 'error';
}

let seq = 0;

/** Zabezpieczenie: nigdy nie renderuj surowej tablicy/obiektu błędu z API jako JSON. */
function normalize(message: unknown): string {
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.filter(Boolean).map(String).join(' ');
  if (message && typeof message === 'object' && 'message' in message) {
    return normalize((message as { message: unknown }).message);
  }
  return message == null ? '' : String(message);
}

export function useToast() {
  const toasts = useState<ToastItem[]>('toasts', () => []);

  function push(message: unknown, kind: ToastItem['kind'] = 'info', ttl = 3500) {
    const id = ++seq;
    toasts.value = [...toasts.value, { id, message: normalize(message), kind }];
    if (import.meta.client) {
      setTimeout(() => {
        toasts.value = toasts.value.filter((t) => t.id !== id);
      }, ttl);
    }
  }

  return {
    toasts,
    toast: (m: unknown) => push(m, 'info'),
    success: (m: unknown) => push(m, 'success'),
    error: (m: unknown) => push(m, 'error'),
    dismiss: (id: number) => (toasts.value = toasts.value.filter((t) => t.id !== id)),
  };
}
