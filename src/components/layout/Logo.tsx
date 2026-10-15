import { APP_NAME } from '@/config/app';
import { cn } from '@/lib/utils';

export function LogoMark({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('size-9 shrink-0', className)} aria-hidden>
      <rect width="64" height="64" rx="16" fill={inverted ? '#ffffff' : '#006948'} />
      <path d="M18 46V18h6l16 18V18h6v28h-6L24 28v18z" fill={inverted ? '#006948' : '#ffffff'} />
    </svg>
  );
}

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark inverted={light} />
      <span className={cn('text-headline-md font-extrabold tracking-tight', light ? 'text-white' : 'text-primary')}>{APP_NAME}</span>
    </span>
  );
}
