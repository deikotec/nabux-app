import type { SVGProps } from 'react';

/** Caja registradora (punto de venta), con el mismo trazo que los íconos de lucide. */
export function PosIcon({ strokeWidth = 2, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <rect x="7" y="2.5" width="10" height="5" rx="1" />
      <path d="M12 7.5v2" />
      <path d="M6 9.5h12l1.5 6h-15z" />
      <rect x="3" y="15.5" width="18" height="6" rx="1.5" />
      <path d="M10 18.5h4" />
      <path d="M9 12.5h.01M12 12.5h.01M15 12.5h.01" />
    </svg>
  );
}
