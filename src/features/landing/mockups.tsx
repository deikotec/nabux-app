/**
 * Maquetas del producto para la landing: la interfaz de Nabux dibujada con HTML (sin capturas),
 * nítida a cualquier tamaño. Los datos son ilustrativos.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  BarChart3,
  Boxes,
  Camera,
  Check,
  CloudOff,
  LayoutGrid,
  Package,
  Receipt,
  ScanLine,
  Search,
  Settings,
  ShoppingCart,
  Sparkles,
  Users
} from 'lucide-react';
import { Logo } from '@/components/layout/Logo';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

/** Dibuja `children` a un tamaño fijo y lo escala para llenar el ancho disponible. */
export function Scaled({ width, height, children, className }: { width: number; height: number; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={ref} className={cn('relative w-full overflow-hidden', className)} style={{ aspectRatio: `${width} / ${height}` }}>
      <div className="absolute top-0 left-0 origin-top-left" style={{ width, height, transform: `scale(${scale})`, visibility: scale ? 'visible' : 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

/** true la primera vez que el elemento entra en pantalla (o de inmediato si se prefiere menos movimiento). */
export function useInView<T extends Element>(threshold = 0.25) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin: '0px 0px -6% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

/* ------------------------------------------------------------------ */
/* Dispositivos                                                        */
/* ------------------------------------------------------------------ */

export function Laptop({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto w-full">
      <div className="rounded-[2.2%/3.4%] bg-[#0c0c0e] p-[1.15%] shadow-[0_50px_100px_-30px_rgba(0,30,20,0.45)] ring-1 ring-black/20">
        <div className="overflow-hidden rounded-[0.9%/1.4%] bg-white">{children}</div>
      </div>
      <div className="relative -mx-[6.5%] h-3 rounded-b-[40%_100%] bg-gradient-to-b from-[#e3e4e8] via-[#c9cbd1] to-[#9a9ca3] shadow-[0_18px_30px_-12px_rgba(0,0,0,0.35)] sm:h-4">
        <div className="absolute top-0 left-1/2 h-[45%] w-[14%] -translate-x-1/2 rounded-b-lg bg-[#b5b7bd]" />
      </div>
    </div>
  );
}

export function Phone({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('relative rounded-[14%/6.6%] bg-[#0c0c0e] p-[3.2%] shadow-[0_40px_80px_-25px_rgba(0,0,0,0.5)] ring-1 ring-white/10', className)}>
      <div className="relative overflow-hidden rounded-[11%/5.2%] bg-white">
        <div className="absolute top-[1.6%] left-1/2 z-10 h-[3.4%] w-[30%] -translate-x-1/2 rounded-full bg-black" />
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel (computadora)                                                 */
/* ------------------------------------------------------------------ */

const NAV = [
  { icon: LayoutGrid, label: 'Panel', active: true },
  { icon: ShoppingCart, label: 'Punto de venta' },
  { icon: Boxes, label: 'Inventario' },
  { icon: Receipt, label: 'Ventas' },
  { icon: BarChart3, label: 'Reportes' },
  { icon: Users, label: 'Personal' },
  { icon: Settings, label: 'Configuración' }
];

const SALES_CURVE = [22, 30, 26, 38, 34, 47, 44, 58, 52, 63, 61, 74];

function areaPath(values: number[], w: number, h: number) {
  const max = Math.max(...values) * 1.1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - (v / max) * h] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return { line, area: `${line} L${w},${h} L0,${h} Z` };
}

export function MockDashboard() {
  const { line, area } = areaPath(SALES_CURVE, 560, 170);
  return (
    <div className="flex h-[800px] w-[1280px] bg-[#f6f7fb] font-[inherit] text-[#131b2e]">
      <aside className="flex w-[232px] flex-col gap-1 border-r border-slate-200/80 bg-white px-4 py-6">
        <div className="mb-6 px-2">
          <Logo className="h-9" />
        </div>
        {NAV.map((n) => (
          <div key={n.label} className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium', n.active ? 'bg-[#006A49] text-white' : 'text-slate-500')}>
            <n.icon className="size-[18px]" />
            {n.label}
          </div>
        ))}
        <div className="mt-auto rounded-2xl bg-[#eef8f3] p-4">
          <p className="text-[13px] font-semibold text-[#006A49]">Bodega La Esquina</p>
          <p className="text-[12px] text-slate-500">Caja abierta · Ana</p>
        </div>
      </aside>
      <main className="flex flex-1 flex-col gap-5 px-8 py-7">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[14px] text-slate-500">Jueves, 15 de octubre</p>
            <h3 className="text-[28px] font-bold tracking-tight">Buenos días, Ana</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-72 items-center gap-2 rounded-full bg-white px-4 text-[14px] text-slate-400 ring-1 ring-slate-200">
              <Search className="size-4" /> Buscar o escanear…
            </div>
            <div className="flex h-11 items-center rounded-full bg-[#006A49] px-5 text-[14px] font-semibold text-white">Nueva venta</div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Ventas de hoy', value: '$1.284,50', delta: '+12 %' },
            { label: 'Tickets', value: '86', delta: '+8 %' },
            { label: 'Ticket promedio', value: '$14,94', delta: '+4 %' },
            { label: 'Por reponer', value: '7', delta: 'productos', warn: true }
          ].map((k) => (
            <div key={k.label} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/70">
              <p className="text-[13px] text-slate-500">{k.label}</p>
              <p className="mt-1 text-[28px] font-bold tracking-tight">{k.value}</p>
              <p className={cn('text-[13px] font-semibold', k.warn ? 'text-amber-600' : 'text-emerald-600')}>{k.delta}</p>
            </div>
          ))}
        </div>
        <div className="grid flex-1 grid-cols-[1.45fr_1fr] gap-4">
          <div className="flex flex-col rounded-2xl bg-white p-6 ring-1 ring-slate-200/70">
            <div className="flex items-center justify-between">
              <p className="text-[17px] font-semibold">Ingresos de la semana</p>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[12px] font-semibold text-slate-600">7 días</span>
            </div>
            <svg viewBox="0 0 560 170" className="mt-5 w-full flex-1" preserveAspectRatio="none">
              <defs>
                <linearGradient id="nx-area" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#00A26C" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#00A26C" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={area} fill="url(#nx-area)" />
              <path d={line} fill="none" stroke="#006A49" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
          </div>
          <div className="flex flex-col gap-3 rounded-2xl bg-white p-6 ring-1 ring-slate-200/70">
            <p className="text-[17px] font-semibold">Últimas ventas</p>
            {[
              ['#1042', 'Pago móvil', '$13,90'],
              ['#1041', 'Efectivo $', '$8,20'],
              ['#1040', 'Punto de venta', '$27,45'],
              ['#1039', 'Zelle', '$42,00'],
              ['#1038', 'Efectivo Bs', '$5,75']
            ].map(([id, method, total]) => (
              <div key={id} className="flex items-center justify-between border-b border-slate-100 pb-2.5 text-[14px] last:border-0">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-[#eef8f3] text-[#006A49]">
                    <Receipt className="size-4" />
                  </span>
                  <div>
                    <p className="font-semibold">Ticket {id}</p>
                    <p className="text-[12px] text-slate-500">{method}</p>
                  </div>
                </div>
                <span className="font-semibold">{total}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Punto de venta (celular)                                            */
/* ------------------------------------------------------------------ */

const TICKET = [
  { name: 'Harina de maíz 1 kg', qty: 2, price: '$2,40', tone: 'bg-amber-100' },
  { name: 'Malta 355 ml', qty: 6, price: '$4,80', tone: 'bg-orange-100' },
  { name: 'Queso blanco 500 g', qty: 1, price: '$3,10', tone: 'bg-sky-100' },
  { name: 'Café molido 250 g', qty: 1, price: '$3,60', tone: 'bg-rose-100' }
];

export function MockPos() {
  return (
    <div className="flex h-[844px] w-[390px] flex-col bg-[#f6f7fb] px-5 pt-16 pb-8 text-[#131b2e]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] text-slate-500">Caja 1 · Ana</p>
          <p className="text-[24px] font-bold tracking-tight">Ticket #1043</p>
        </div>
        <span className="flex size-11 items-center justify-center rounded-full bg-white text-[#006A49] ring-1 ring-slate-200">
          <ScanLine className="size-5" />
        </span>
      </div>
      <div className="mt-5 flex flex-col gap-2.5">
        {TICKET.map((t) => (
          <div key={t.name} className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200/70">
            <span className={cn('flex size-12 items-center justify-center rounded-xl', t.tone)}>
              <Package className="size-5 text-slate-600" />
            </span>
            <div className="flex-1">
              <p className="text-[15px] font-semibold">{t.name}</p>
              <p className="text-[13px] text-slate-500">× {t.qty}</p>
            </div>
            <span className="text-[15px] font-semibold">{t.price}</span>
          </div>
        ))}
      </div>
      <div className="mt-auto flex flex-col gap-3 rounded-3xl bg-white p-5 ring-1 ring-slate-200/70">
        <div className="flex justify-between text-[14px] text-slate-500">
          <span>Subtotal</span>
          <span>$13,90</span>
        </div>
        <div className="flex items-end justify-between">
          <span className="text-[15px] font-semibold">Total</span>
          <span className="text-right">
            <span className="block text-[30px] leading-none font-bold tracking-tight">$13,90</span>
            <span className="text-[13px] text-slate-500">Bs. 507,63</span>
          </span>
        </div>
        <div className="flex gap-2">
          {['Efectivo $', 'Pago móvil', 'Punto'].map((m, i) => (
            <span key={m} className={cn('flex-1 rounded-xl py-2 text-center text-[13px] font-semibold', i === 1 ? 'bg-[#006A49] text-white' : 'bg-slate-100 text-slate-600')}>
              {m}
            </span>
          ))}
        </div>
        <div className="flex h-14 items-center justify-center rounded-2xl bg-[#006A49] text-[17px] font-semibold text-white">Cobrar $13,90</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* IA: de la foto de la factura a productos                            */
/* ------------------------------------------------------------------ */

const INVOICE = [
  { qty: 24, name: 'Harina de maíz 1 kg', cost: '0,90', cat: 'Abarrotes', state: 'Suma +24' },
  { qty: 12, name: 'Aceite vegetal 1 L', cost: '2,50', cat: 'Aceites', state: 'Nuevo' },
  { qty: 36, name: 'Malta 355 ml', cost: '0,55', cat: 'Bebidas', state: 'Suma +36' },
  { qty: 10, name: 'Arroz blanco 1 kg', cost: '1,05', cat: 'Abarrotes', state: 'Nuevo' }
];

export function MockInvoiceScan() {
  const [ref, inView] = useInView<HTMLDivElement>(0.3);
  return (
    <div ref={ref} className={cn('nx-scan grid items-center gap-6 md:grid-cols-[0.9fr_1.1fr] md:gap-10', inView && 'nx-scan-on')}>
      {/* La foto */}
      <div className="relative mx-auto w-full max-w-sm">
        <div className="relative -rotate-2 rounded-2xl bg-[#fbfaf6] p-6 text-[#2b2b2b] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)]">
          <p className="text-[11px] font-bold tracking-[0.2em] text-slate-500">DISTRIBUIDORA EL SOL</p>
          <p className="mt-1 text-[15px] font-semibold">Factura N.º 004512</p>
          <div className="mt-4 flex flex-col gap-2 font-mono text-[12px]">
            <div className="flex justify-between border-b border-dashed border-slate-300 pb-1.5 text-[10px] tracking-wider text-slate-500">
              <span>CANT · DESCRIPCIÓN</span>
              <span>P. UNIT</span>
            </div>
            {INVOICE.map((r) => (
              <div key={r.name} className="flex justify-between">
                <span>
                  {String(r.qty).padStart(2, '0')} · {r.name}
                </span>
                <span>{r.cost}</span>
              </div>
            ))}
            <div className="mt-2 flex justify-between border-t border-dashed border-slate-300 pt-2 font-semibold">
              <span>TOTAL $</span>
              <span>81,90</span>
            </div>
          </div>
          <div className="nx-beam pointer-events-none absolute inset-x-3 top-6 h-10 rounded-full" aria-hidden />
        </div>
        <span className="absolute -top-4 -left-3 flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white ring-1 ring-white/20 backdrop-blur">
          <Camera className="size-3.5" /> factura.jpg
        </span>
      </div>

      {/* Lo que leyó la IA */}
      <div className="rounded-3xl bg-white/[0.06] p-4 ring-1 ring-white/10 backdrop-blur sm:p-5">
        <div className="mb-3 flex items-center justify-between px-1">
          <p className="flex items-center gap-2 text-[15px] font-semibold text-white">
            <Sparkles className="size-4 text-[#95CDB2]" /> 4 productos detectados
          </p>
          <span className="text-[12px] text-white/50">Revisa y confirma</span>
        </div>
        <div className="flex flex-col gap-2">
          {INVOICE.map((r, i) => (
            <div key={r.name} className="nx-row flex items-center gap-3 rounded-2xl bg-white/[0.07] px-3 py-2.5" style={{ animationDelay: `${600 + i * 380}ms` }}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/80">
                <Package className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-white">{r.name}</p>
                <p className="text-[12px] text-white/55">
                  {r.qty} u. · costo ${r.cost}
                </p>
              </div>
              <span className="hidden rounded-full bg-[#95CDB2]/15 px-2.5 py-1 text-[11px] font-semibold text-[#95CDB2] sm:inline">{r.cat}</span>
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 text-[11px] font-semibold',
                  r.state === 'Nuevo' ? 'bg-white/10 text-white/80' : 'bg-sky-400/15 text-sky-300'
                )}
              >
                {r.state}
              </span>
            </div>
          ))}
        </div>
        <div className="nx-row mt-3 flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#00A26C] text-[14px] font-semibold text-white" style={{ animationDelay: '2200ms' }}>
          <Check className="size-4" /> Importar y sumar al inventario
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bimonetario                                                         */
/* ------------------------------------------------------------------ */

export function MockFx() {
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4 sm:grid-cols-[0.85fr_1.15fr]">
      <div className="flex flex-col justify-between rounded-3xl bg-[#f5f5f7] p-6">
        <div>
          <p className="text-[13px] font-semibold text-[#6e6e73]">Tasa BCV · hoy</p>
          <p className="mt-1 text-[44px] leading-none font-semibold tracking-tight text-[#1d1d1f]">
            36,52 <span className="text-[20px] font-medium text-[#6e6e73]">Bs/$</span>
          </p>
        </div>
        <svg viewBox="0 0 200 60" className="mt-6 h-16 w-full" aria-hidden>
          <path d="M0,48 C30,46 40,40 60,41 C85,42 95,30 120,28 C140,26 160,18 200,12" fill="none" stroke="#006A49" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <div className="mt-4 flex gap-2 text-[12px] font-semibold">
          <span className="rounded-full bg-white px-3 py-1.5 text-[#006A49] ring-1 ring-black/5">BCV</span>
          <span className="rounded-full px-3 py-1.5 text-[#6e6e73]">Paralelo</span>
          <span className="rounded-full px-3 py-1.5 text-[#6e6e73]">Propia</span>
        </div>
      </div>
      <div className="flex flex-col gap-3 rounded-3xl bg-[#f5f5f7] p-6">
        <div className="flex items-end justify-between">
          <span className="text-[15px] font-semibold text-[#1d1d1f]">Total</span>
          <span className="text-right">
            <span className="block text-[32px] leading-none font-semibold tracking-tight text-[#1d1d1f]">$24,50</span>
            <span className="text-[14px] text-[#6e6e73]">Bs. 894,74</span>
          </span>
        </div>
        <div className="h-px bg-black/5" />
        {[
          ['Efectivo $', '$10,00', 'IGTF 3 % · $0,30'],
          ['Pago móvil', 'Bs. 529,54', 'Ref. 0423'],
          ['Vuelto', 'Bs. 0,00', '']
        ].map(([m, v, note]) => (
          <div key={m} className="flex items-center justify-between text-[15px]">
            <span className="text-[#1d1d1f]">
              {m}
              {note && <span className="block text-[12px] text-[#6e6e73]">{note}</span>}
            </span>
            <span className="font-semibold text-[#1d1d1f]">{v}</span>
          </div>
        ))}
        <div className="mt-auto flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-[14px] font-semibold text-[#006A49] ring-1 ring-black/5">
          <Check className="size-4" /> Pagado · todo cuadra
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Visuales pequeños para las tarjetas                                 */
/* ------------------------------------------------------------------ */

export function MiniBars() {
  const bars = [42, 58, 50, 72, 64, 90, 78];
  const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  return (
    <div className="flex h-40 gap-2.5" aria-hidden>
      {bars.map((b, i) => (
        <div key={i} className="flex h-full flex-1 flex-col items-center gap-2">
          <div className="relative w-full flex-1">
            <div className={cn('absolute inset-x-0 bottom-0 rounded-lg', i === 5 ? 'bg-[#006A49]' : 'bg-[#006A49]/20')} style={{ height: `${b}%` }} />
          </div>
          <span className="text-[11px] font-semibold text-[#86868b]">{days[i]}</span>
        </div>
      ))}
    </div>
  );
}

export function MiniStock() {
  const rows = [
    { name: 'Malta 355 ml', left: 4, min: 12, tone: 'bg-amber-500' },
    { name: 'Café molido 250 g', left: 0, min: 6, tone: 'bg-red-500' },
    { name: 'Arroz blanco 1 kg', left: 28, min: 10, tone: 'bg-[#00A26C]' }
  ];
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {rows.map((r) => (
        <div key={r.name} className="flex flex-col gap-1.5">
          <div className="flex justify-between text-[13px]">
            <span className="font-medium text-[#1d1d1f]">{r.name}</span>
            <span className="text-[#6e6e73]">{r.left ? `${r.left} u.` : 'Agotado'}</span>
          </div>
          <div className="h-1.5 rounded-full bg-black/5">
            <div className={cn('h-full rounded-full', r.tone)} style={{ width: `${Math.max(4, Math.min(100, (r.left / (r.min * 2.5)) * 100))}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MiniTeam() {
  const people = [
    { initials: 'AR', role: 'Propietaria', tone: 'bg-emerald-100 text-emerald-800' },
    { initials: 'JM', role: 'Cajero', tone: 'bg-sky-100 text-sky-800' },
    { initials: 'LP', role: 'Almacén', tone: 'bg-amber-100 text-amber-800' }
  ];
  return (
    <div className="flex flex-col gap-2.5" aria-hidden>
      {people.map((p) => (
        <div key={p.initials} className="flex items-center gap-3">
          <span className={cn('flex size-9 items-center justify-center rounded-full text-[12px] font-bold', p.tone)}>{p.initials}</span>
          <span className="flex-1 text-[14px] font-medium text-[#1d1d1f]">{p.role}</span>
          <span className="h-5 w-9 rounded-full bg-[#00A26C] p-0.5">
            <span className="ml-auto block size-4 rounded-full bg-white" />
          </span>
        </div>
      ))}
    </div>
  );
}

export function MiniOffline() {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <span className="flex size-14 items-center justify-center rounded-2xl bg-white text-[#1d1d1f] ring-1 ring-black/5">
        <CloudOff className="size-6" />
      </span>
      <div className="flex flex-col gap-1.5">
        <span className="w-fit rounded-full bg-amber-100 px-2.5 py-1 text-[12px] font-semibold text-amber-800">Sin conexión · 3 ventas en cola</span>
        <span className="w-fit rounded-full bg-emerald-100 px-2.5 py-1 text-[12px] font-semibold text-emerald-800">Conectado · todo sincronizado</span>
      </div>
    </div>
  );
}
