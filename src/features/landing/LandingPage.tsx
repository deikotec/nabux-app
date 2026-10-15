/**
 * Landing pública de Nabux (/, sin sesión, y /inicio).
 *
 * Estilo Apple: titulares grandes y cortos, mucho aire, secciones que alternan blanco, gris
 * claro y negro, y el producto como protagonista. El tono también: frases breves, en
 * presente, de tú, sin tecnicismos. Todo lo que se promete aquí existe en la app.
 */
import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  BarChart3,
  Boxes,
  Building2,
  ChevronRight,
  FileSpreadsheet,
  History,
  Keyboard,
  Laptop as LaptopIcon,
  Layers,
  PauseCircle,
  Printer,
  ScanLine,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Tablet,
  Tags,
  Users,
  WalletCards,
  type LucideIcon
} from 'lucide-react';
import { Logo, LogoMark } from '@/components/layout/Logo';
import { APP_NAME } from '@/config/app';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Laptop, MiniBars, MiniOffline, MiniStock, MiniTeam, MockDashboard, MockFx, MockInvoiceScan, MockPos, Phone, Scaled, useInView } from './mockups';
import './landing.css';

const INTER = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';

/* ------------------------------------------------------------------ */
/* Piezas                                                              */
/* ------------------------------------------------------------------ */

function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const [ref, inView] = useInView<HTMLDivElement>(0.15);
  return (
    <div ref={ref} className={cn('nx-reveal', inView && 'nx-in', className)} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}

function PrimaryButton({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex h-12 items-center justify-center rounded-full bg-[#006A49] px-7 text-[17px] font-medium text-white transition-colors hover:bg-[#005237] focus-visible:ring-4 focus-visible:ring-[#00A26C]/40 focus-visible:outline-none',
        className
      )}
    >
      {children}
    </Link>
  );
}

function ArrowLink({ to, href, children, dark }: { to?: string; href?: string; children: ReactNode; dark?: boolean }) {
  const cls = cn('group inline-flex items-center gap-0.5 text-[17px] font-medium hover:underline', dark ? 'text-[#95CDB2]' : 'text-[#006A49]');
  const inner = (
    <>
      {children}
      <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </>
  );
  return to ? (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  ) : (
    <a href={href} className={cls}>
      {inner}
    </a>
  );
}

function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-[17px] font-semibold text-[#006A49] sm:text-[21px]', className)}>{children}</p>;
}

function Headline({ children, className, as: Tag = 'h2' }: { children: ReactNode; className?: string; as?: 'h1' | 'h2' }) {
  return <Tag className={cn('text-[40px] leading-[1.08] font-semibold tracking-[-0.022em] sm:text-[56px] lg:text-[64px]', className)}>{children}</Tag>;
}

function Lead({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-[19px] leading-[1.42] text-[#6e6e73] sm:text-[21px]', className)}>{children}</p>;
}

/* ------------------------------------------------------------------ */
/* Navegación                                                          */
/* ------------------------------------------------------------------ */

function Nav({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-50 border-b border-black/[0.06] bg-white/75 backdrop-blur-xl backdrop-saturate-150">
      <nav className="mx-auto flex h-12 max-w-5xl items-center justify-between gap-4 px-4" aria-label="Principal">
        <Link to="/" className="flex items-center" aria-label={`${APP_NAME}, inicio`}>
          <Logo className="h-[26px]" />
        </Link>
        <div className="hidden items-center gap-7 text-[13px] text-[#1d1d1f]/80 md:flex">
          <a href="#funciones" className="hover:text-[#1d1d1f]">
            Funciones
          </a>
          <a href="#ia" className="hover:text-[#1d1d1f]">
            IA
          </a>
          <a href="#punto-de-venta" className="hover:text-[#1d1d1f]">
            Punto de venta
          </a>
          <a href="#bimonetario" className="hover:text-[#1d1d1f]">
            Dólares y bolívares
          </a>
        </div>
        <div className="flex items-center gap-4">
          {signedIn ? (
            <Link to="/" className="inline-flex h-8 items-center rounded-full bg-[#006A49] px-4 text-[13px] font-medium text-white hover:bg-[#005237]">
              Abrir {APP_NAME}
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-[13px] text-[#1d1d1f]/80 hover:text-[#1d1d1f]">
                Iniciar sesión
              </Link>
              <Link to="/registro" className="inline-flex h-8 items-center rounded-full bg-[#006A49] px-4 text-[13px] font-medium text-white hover:bg-[#005237]">
                Empieza gratis
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Secciones                                                           */
/* ------------------------------------------------------------------ */

function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="overflow-hidden px-4 pt-14 pb-20 text-center sm:pt-24 sm:pb-28">
      <Eyebrow className="nx-rise">Inventario y punto de venta</Eyebrow>
      <h1 className="nx-rise nx-rise-2 mx-auto mt-3 max-w-4xl text-[52px] leading-[1.04] font-semibold tracking-[-0.03em] sm:text-[80px] lg:text-[96px]">
        Tu negocio.
        <br />
        Bajo control.
      </h1>
      <Lead className="nx-rise nx-rise-3 mx-auto mt-6 max-w-2xl sm:text-[24px]">
        Vende, controla tu inventario y entiende tus números desde un solo lugar. Sin instalar nada. Sin complicaciones.
      </Lead>
      <div className="nx-rise nx-rise-4 mt-9 flex flex-col items-center justify-center gap-5 sm:flex-row sm:gap-8">
        {signedIn ? (
          <PrimaryButton to="/">Abrir {APP_NAME}</PrimaryButton>
        ) : (
          <>
            <PrimaryButton to="/registro">Empieza gratis</PrimaryButton>
            <ArrowLink to="/login">Ya tengo cuenta</ArrowLink>
          </>
        )}
      </div>
      <Reveal className="relative mx-auto mt-16 max-w-5xl sm:mt-24">
        <div className="pointer-events-none absolute inset-x-[10%] top-[18%] -z-10 h-[70%] rounded-full bg-[#00A26C]/20 blur-[90px]" aria-hidden />
        <Laptop>
          <Scaled width={1280} height={800}>
            <MockDashboard />
          </Scaled>
        </Laptop>
      </Reveal>
    </section>
  );
}

const HIGHLIGHTS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: ShoppingCart, title: 'Punto de venta', text: 'Cobra en segundos, con o sin internet.' },
  { icon: Boxes, title: 'Inventario', text: 'Stock, costos y márgenes siempre al día.' },
  { icon: BarChart3, title: 'Reportes', text: 'Tus números, claros como nunca.' },
  { icon: Users, title: 'Equipo', text: 'Cada quien, con el acceso que le toca.' }
];

function Highlights() {
  return (
    <section id="funciones" className="border-t border-black/[0.06] px-4 py-16 sm:py-24">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-4">
        {HIGHLIGHTS.map((h, i) => (
          <Reveal key={h.title} delay={i * 90} className="flex flex-col items-center text-center md:items-start md:text-left">
            <h.icon className="size-9 text-[#006A49]" strokeWidth={1.6} aria-hidden />
            <h3 className="mt-4 text-[21px] font-semibold tracking-tight">{h.title}</h3>
            <p className="mt-1 text-[17px] leading-snug text-[#6e6e73]">{h.text}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const AI_FACTS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: FileSpreadsheet, title: 'Tu Excel, tal cual.', text: 'Con títulos, totales y hasta las fotos de cada producto. Nabux encuentra la tabla y entiende cada columna.' },
  { icon: Tags, title: 'Categorías solas.', text: 'Propone categorías para todo tu catálogo y ordena en segundos lo que antes tomaba una tarde.' },
  { icon: ShieldCheck, title: 'Tú tienes la última palabra.', text: 'Nada se guarda sin tu visto bueno. Revisas, corriges y confirmas.' }
];

function AiSection() {
  return (
    <section id="ia" className="bg-black px-4 py-24 text-white sm:py-32">
      <div className="mx-auto max-w-5xl">
        <Reveal className="text-center">
          <p className="nx-gradient-text inline-flex items-center gap-2 text-[17px] font-semibold sm:text-[21px]">
            <Sparkles className="size-5 text-[#95CDB2]" aria-hidden /> {APP_NAME} IA
          </p>
          <Headline className="mt-3">
            Una foto.
            <br />
            Todo tu inventario.
          </Headline>
          <Lead className="mx-auto mt-6 max-w-2xl text-white/60">
            Fotografía la factura de tu proveedor o tu lista de precios. Nabux reconoce cada producto, su costo, la cantidad y hasta su categoría. Lo que ya
            tienes, lo suma. Lo nuevo, lo crea.
          </Lead>
        </Reveal>
        <Reveal className="mt-14 sm:mt-20">
          <MockInvoiceScan />
        </Reveal>
        <div className="mt-20 grid gap-10 sm:mt-24 md:grid-cols-3">
          {AI_FACTS.map((f, i) => (
            <Reveal key={f.title} delay={i * 110}>
              <f.icon className="size-8 text-[#95CDB2]" strokeWidth={1.6} aria-hidden />
              <h3 className="mt-4 text-[21px] font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-2 text-[17px] leading-snug text-white/60">{f.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const POS_FEATURES: { icon: LucideIcon; text: string }[] = [
  { icon: ScanLine, text: 'Lector de códigos de barras' },
  { icon: PauseCircle, text: 'Tickets en espera' },
  { icon: WalletCards, text: 'Pagos mixtos y vuelto' },
  { icon: Printer, text: 'Ticket impreso de 80 mm' },
  { icon: Keyboard, text: 'Atajos de teclado' },
  { icon: Layers, text: 'Corte de caja al cierre' }
];

function PosSection() {
  const [ref, inView] = useInView<HTMLDivElement>(0.2);
  return (
    <section id="punto-de-venta" className="overflow-hidden bg-[#f5f5f7] px-4 py-24 sm:py-32">
      <div className="mx-auto grid max-w-5xl items-center gap-16 md:grid-cols-[1.35fr_0.65fr]">
        <Reveal>
          <Eyebrow>Punto de venta</Eyebrow>
          <Headline className="mt-3 sm:text-[48px] lg:text-[56px]">
            Vende en segundos.
            <br />
            Incluso sin internet.
          </Headline>
          <Lead className="mt-6">
            Escanea, cobra e imprime el ticket. Si se va la conexión, sigues vendiendo: cada venta se guarda y se sincroniza sola cuando vuelve.
          </Lead>
          <ul className="mt-10 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            {POS_FEATURES.map((f) => (
              <li key={f.text} className="flex items-center gap-3 text-[17px]">
                <f.icon className="size-5 shrink-0 text-[#006A49]" aria-hidden />
                {f.text}
              </li>
            ))}
          </ul>
        </Reveal>
        <div
          ref={ref}
          className={cn('mx-auto w-full max-w-[300px] transition-all duration-[1100ms] ease-[cubic-bezier(0.25,0.1,0.25,1)]', inView ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0')}
        >
          <Phone>
            <Scaled width={390} height={844}>
              <MockPos />
            </Scaled>
          </Phone>
        </div>
      </div>
    </section>
  );
}

function FxSection() {
  return (
    <section id="bimonetario" className="px-4 py-24 sm:py-32">
      <div className="mx-auto max-w-5xl">
        <Reveal className="text-center">
          <Eyebrow>Hecho para Venezuela</Eyebrow>
          <Headline className="mt-3">
            Dólares y bolívares.
            <br />
            A la vez.
          </Headline>
          <Lead className="mx-auto mt-6 max-w-2xl">
            Tus precios en dólares, cobrados también en bolívares a la tasa del día: BCV, paralelo o la tuya. Pago móvil, Zelle, punto o efectivo. Con IGTF e
            IVA calculados. Y al cierre, todo cuadra.
          </Lead>
        </Reveal>
        <Reveal className="mt-14 sm:mt-20" delay={100}>
          <MockFx />
        </Reveal>
      </div>
    </section>
  );
}

function Tile({ title, text, children, className, delay }: { title: string; text: string; children?: ReactNode; className?: string; delay?: number }) {
  return (
    <Reveal delay={delay} className={cn('flex flex-col justify-between gap-8 rounded-[28px] bg-white p-7 sm:p-8', className)}>
      <div>
        <h3 className="text-[24px] leading-tight font-semibold tracking-tight">{title}</h3>
        <p className="mt-2 text-[17px] leading-snug text-[#6e6e73]">{text}</p>
      </div>
      {children}
    </Reveal>
  );
}

function Bento() {
  return (
    <section className="bg-[#f5f5f7] px-4 py-24 sm:py-32">
      <div className="mx-auto max-w-5xl">
        <Reveal className="text-center">
          <Headline>
            Todo lo que necesitas.
            <br />
            Nada que no.
          </Headline>
        </Reveal>
        <div className="mt-14 grid gap-4 sm:mt-20 md:grid-cols-3">
          <Tile className="md:col-span-2" title="Reportes que se entienden." text="Ventas, utilidad, horas pico, productos estrella y cortes de caja. De un vistazo.">
            <MiniBars />
          </Tile>
          <Tile title="Stock bajo, a la vista." text="Nabux te avisa antes de que algo se agote." delay={80}>
            <MiniStock />
          </Tile>
          <Tile title="Las llaves justas." text="Invita a tu equipo. Cada quien ve y hace solo lo que le toca." delay={80}>
            <MiniTeam />
          </Tile>
          <Tile className="md:col-span-2" title="Sin internet, sin pausa." text="El punto de venta sigue funcionando. Cuando vuelve la conexión, todo se pone al día solo." delay={160}>
            <MiniOffline />
          </Tile>
          <Tile title="Kárdex de cada producto." text="Cada entrada, venta y ajuste queda registrado, con quién y cuándo." delay={80}>
            <History className="size-10 text-[#006A49]" strokeWidth={1.4} aria-hidden />
          </Tile>
          <Tile title="Varios negocios. Una cuenta." text="Cambia de tienda en un toque, cada una con su inventario y su equipo." delay={160}>
            <Building2 className="size-10 text-[#006A49]" strokeWidth={1.4} aria-hidden />
          </Tile>
          <Tile title="En cualquier pantalla." text="Computadora, tablet o celular. Sin instalar nada." delay={240}>
            <div className="flex items-end gap-3 text-[#006A49]" aria-hidden>
              <LaptopIcon className="size-10" strokeWidth={1.4} />
              <Tablet className="size-8" strokeWidth={1.4} />
              <Smartphone className="size-7" strokeWidth={1.4} />
            </div>
          </Tile>
        </div>
      </div>
    </section>
  );
}

function FinalCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="px-4 py-28 text-center sm:py-40">
      <Reveal>
        <LogoMark className="mx-auto size-16 sm:size-20" />
        <Headline className="mt-8">
          Empieza hoy.
          <br />
          Es así de simple.
        </Headline>
        <Lead className="mx-auto mt-6 max-w-xl">Crea tu cuenta, registra tu negocio y haz tu primera venta en minutos.</Lead>
        <div className="mt-9 flex flex-col items-center justify-center gap-5 sm:flex-row sm:gap-8">
          {signedIn ? (
            <PrimaryButton to="/">Abrir {APP_NAME}</PrimaryButton>
          ) : (
            <>
              <PrimaryButton to="/registro">Crear mi cuenta gratis</PrimaryButton>
              <ArrowLink href="#ia">Descubre Nabux IA</ArrowLink>
            </>
          )}
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-[#f5f5f7] px-4 py-8 text-[12px] leading-relaxed text-[#6e6e73]">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <p className="border-b border-black/10 pb-4">Los productos, nombres y cifras que aparecen en esta página son ilustrativos.</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {APP_NAME}. Inventario y punto de venta en la nube.
          </p>
          <div className="flex gap-5">
            <Link to="/login" className="hover:underline">
              Iniciar sesión
            </Link>
            <Link to="/registro" className="hover:underline">
              Crear cuenta
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  const { user } = useAuth();
  const signedIn = !!user;

  useEffect(() => {
    const prevTitle = document.title;
    document.title = `${APP_NAME} — Tu negocio. Bajo control.`;
    // Inter: la tipografía más cercana a la de Apple fuera de sus equipos (en Mac y iPhone se usa SF Pro).
    if (!document.querySelector(`link[href="${INTER}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = INTER;
      document.head.appendChild(link);
    }
    return () => {
      document.title = prevTitle;
    };
  }, []);

  return (
    <div className="nx-landing min-h-dvh bg-white text-[#1d1d1f]">
      <Nav signedIn={signedIn} />
      <main>
        <Hero signedIn={signedIn} />
        <Highlights />
        <AiSection />
        <PosSection />
        <FxSection />
        <Bento />
        <FinalCta signedIn={signedIn} />
      </main>
      <Footer />
    </div>
  );
}
