import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft' | 'tonal' | 'dark';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl' | 'icon' | 'icon-sm';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  /** Atajo de teclado a mostrar a la derecha, ej. "F10". */
  kbd?: string;
  fullWidth?: boolean;
  ref?: Ref<HTMLButtonElement>;
  children?: ReactNode;
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active shadow-card',
  secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-card',
  ghost: 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
  danger: 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100',
  soft: 'bg-surface-container text-on-surface hover:bg-surface-container-high',
  tonal: 'bg-primary-fixed/40 text-on-primary-fixed-variant hover:bg-primary-fixed/60',
  dark: 'bg-inverse-surface text-white hover:bg-slate-800'
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 gap-1.5 text-label-md rounded-lg',
  md: 'h-10 px-4 gap-2 text-label-lg rounded-lg',
  lg: 'h-12 px-5 gap-2 text-label-lg rounded-xl',
  xl: 'h-14 px-6 gap-3 text-headline-sm rounded-xl',
  icon: 'h-10 w-10 rounded-lg',
  'icon-sm': 'h-8 w-8 rounded-lg'
};

const iconSizes: Record<ButtonSize, string> = {
  sm: 'size-4',
  md: 'size-[18px]',
  lg: 'size-5',
  xl: 'size-6',
  icon: 'size-5',
  'icon-sm': 'size-4'
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon: Icon,
  iconRight: IconRight,
  kbd,
  fullWidth,
  className,
  children,
  disabled,
  type = 'button',
  ref,
  ...rest
}: ButtonProps) {
  // Si el consumidor define su propio display base (ej. "hidden sm:inline-flex"), no forzamos inline-flex.
  const customDisplay = /(^|\s)(hidden|block|flex|grid|inline-flex|inline-block)(\s|$)/.test(className ?? '');
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        !customDisplay && 'inline-flex',
        'shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-colors select-none',
        'disabled:cursor-not-allowed disabled:opacity-55',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
      {...rest}
    >
      {loading ? <Loader2 className={cn(iconSizes[size], 'animate-spin')} /> : Icon ? <Icon className={iconSizes[size]} /> : null}
      {children}
      {IconRight && !loading && <IconRight className={iconSizes[size]} />}
      {kbd && (
        <kbd
          className={cn(
            'ml-auto rounded px-1.5 py-0.5 font-sans text-[11px] font-semibold tnum pointer-coarse:hidden',
            variant === 'primary' || variant === 'dark' ? 'bg-white/15 text-white' : 'bg-surface-container text-on-surface-variant'
          )}
        >
          {kbd}
        </kbd>
      )}
    </button>
  );
}

export function IconButton({
  icon: Icon,
  label,
  variant = 'ghost',
  size = 'icon',
  className,
  ...rest
}: Omit<ButtonProps, 'icon' | 'children'> & { icon: LucideIcon; label: string }) {
  return (
    <Button variant={variant} size={size} aria-label={label} title={label} className={className} {...rest}>
      <Icon className={size === 'icon-sm' ? 'size-4' : 'size-5'} />
    </Button>
  );
}
