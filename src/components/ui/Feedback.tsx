import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { Field, Textarea } from './Form';
import { Modal } from './Modal';

/* ------------------------------------------------------------------ */
/* Toasts                                                              */
/* ------------------------------------------------------------------ */

type ToastType = 'success' | 'error' | 'info' | 'warning';
interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastApi {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
  warning: (msg: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const toastIcon = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle };
const toastTone = {
  success: 'text-emerald-400',
  error: 'text-red-400',
  info: 'text-sky-300',
  warning: 'text-amber-300'
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const push = useCallback((type: ToastType, message: string) => {
    const id = ++idRef.current;
    setItems((prev) => [...prev.slice(-3), { id, type, message }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), type === 'error' ? 6000 : 3800);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
      warning: (m) => push('warning', m)
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 left-4 z-[80] flex flex-col items-end gap-2 sm:left-auto">
        {items.map((t) => {
          const Icon = toastIcon[t.type];
          return (
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto flex w-full max-w-sm animate-pop-in items-start gap-3 rounded-xl bg-inverse-surface px-4 py-3 text-white shadow-overlay"
            >
              <Icon className={cn('mt-0.5 size-5 shrink-0', toastTone[t.type])} />
              <span className="text-body-md">{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}

/* ------------------------------------------------------------------ */
/* Confirmaciones                                                      */
/* ------------------------------------------------------------------ */

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
}

export interface PromptOptions extends ConfirmOptions {
  inputLabel?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
}

interface DialogState {
  kind: 'confirm' | 'prompt';
  opts: PromptOptions;
  resolve: (v: boolean | string | null) => void;
}

interface ConfirmApi {
  /** Devuelve true si el usuario confirma. */
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  /** Pide un texto (ej. motivo de anulación). Devuelve null si cancela. */
  prompt: (opts: PromptOptions) => Promise<string | null>;
}

const ConfirmContext = createContext<ConfirmApi | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [text, setText] = useState('');

  const api = useMemo<ConfirmApi>(
    () => ({
      confirm: (opts) => new Promise((resolve) => setDialog({ kind: 'confirm', opts, resolve: (v) => resolve(v === true) })),
      prompt: (opts) =>
        new Promise((resolve) => {
          setText(opts.defaultValue ?? '');
          setDialog({ kind: 'prompt', opts, resolve: (v) => resolve(typeof v === 'string' ? v : null) });
        })
    }),
    []
  );

  const close = (value: boolean | string | null) => {
    dialog?.resolve(value);
    setDialog(null);
  };

  const opts = dialog?.opts;
  const tone = opts?.tone ?? 'danger';
  const canSubmit = dialog?.kind !== 'prompt' || !opts?.required || text.trim().length > 0;

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      <Modal
        open={!!dialog}
        onClose={() => close(dialog?.kind === 'prompt' ? null : false)}
        title={opts?.title}
        icon={tone === 'danger' ? AlertTriangle : Info}
        iconTone={tone === 'danger' ? 'danger' : 'primary'}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => close(dialog?.kind === 'prompt' ? null : false)}>
              {opts?.cancelLabel ?? 'Cancelar'}
            </Button>
            <Button
              variant={tone === 'danger' ? 'danger' : 'primary'}
              disabled={!canSubmit}
              onClick={() => close(dialog?.kind === 'prompt' ? text.trim() : true)}
              data-autofocus={dialog?.kind === 'confirm' ? true : undefined}
            >
              {opts?.confirmLabel ?? 'Confirmar'}
            </Button>
          </>
        }
      >
        {opts?.message && <div className="text-body-md text-on-surface-variant">{opts.message}</div>}
        {dialog?.kind === 'prompt' && (
          <Field label={opts?.inputLabel} required={opts?.required} className="mt-4">
            <Textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={opts?.placeholder}
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && canSubmit) {
                  e.preventDefault();
                  close(text.trim());
                }
              }}
            />
          </Field>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm debe usarse dentro de <ConfirmProvider>');
  return ctx;
}
