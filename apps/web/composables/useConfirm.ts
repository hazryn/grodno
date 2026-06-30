/**
 * Globalne potwierdzenia w modalu aplikacji (NIGDY window.confirm).
 * Host: components/common/ConfirmDialog.vue. Użycie:
 *   const { ask } = useConfirm();
 *   if (await ask({ title: 'Usunąć zdjęcie?', confirmLabel: 'Usuń', danger: true })) { ... }
 */
export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface ConfirmState extends ConfirmOptions {
  open: boolean;
  resolve: ((ok: boolean) => void) | null;
}

export function useConfirm() {
  const state = useState<ConfirmState>('confirm', () => ({
    open: false,
    title: '',
    resolve: null,
  }));

  function ask(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      state.value = { ...options, open: true, resolve };
    });
  }

  function settle(ok: boolean) {
    state.value.resolve?.(ok);
    state.value = { open: false, title: '', resolve: null };
  }

  return { state, ask, settle };
}
