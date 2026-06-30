/** Globalne toasty aplikacji (zamiast window.alert). Host: components/common/Toaster.vue. */
export interface ToastItem {
  id: number;
  message: string;
  kind: 'info' | 'success' | 'error';
}

let seq = 0;

export function useToast() {
  const toasts = useState<ToastItem[]>('toasts', () => []);

  function push(message: string, kind: ToastItem['kind'] = 'info', ttl = 3500) {
    const id = ++seq;
    toasts.value = [...toasts.value, { id, message, kind }];
    if (import.meta.client) {
      setTimeout(() => {
        toasts.value = toasts.value.filter((t) => t.id !== id);
      }, ttl);
    }
  }

  return {
    toasts,
    toast: (m: string) => push(m, 'info'),
    success: (m: string) => push(m, 'success'),
    error: (m: string) => push(m, 'error'),
    dismiss: (id: number) => (toasts.value = toasts.value.filter((t) => t.id !== id)),
  };
}
