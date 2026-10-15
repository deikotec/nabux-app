import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Miniatura de una foto por importar (Blob en memoria o enlace), o de la foto actual del producto. */
export function Thumb({ blob, url, fallbackUrl, className }: { blob?: Blob | null; url?: string | null; fallbackUrl?: string | null; className?: string }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
    if (!blob) {
      setObjectUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setObjectUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  const src = objectUrl ?? url ?? null;
  const shown = !broken && (src ?? fallbackUrl);
  if (!shown) {
    return (
      <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-slate-400', className)}>
        <ImageOff className="size-4" aria-hidden />
      </div>
    );
  }
  return (
    <img
      src={shown}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
      className={cn('size-10 shrink-0 rounded-lg bg-slate-50 object-cover', !src && 'opacity-50 grayscale', className)}
    />
  );
}
