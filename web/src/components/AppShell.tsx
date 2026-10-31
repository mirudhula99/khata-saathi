import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { BellRing, BookOpen, CalendarPlus, LayoutGrid, Mic } from 'lucide-react';
import { PaytmCard, TopBar, paytmChipClass } from '@/components/paytm';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * App shell, Paytm edition (spec .superdesign/paytm-pods-spec.md). Phone frame on desktop (390x844), full screen on a phone.
 * The frame paints --p-page with the sky gradient behind the top ~160px (see .ks-frame in index.css); the top bar is transparent.
 * Tab bar: white, upward shadow, 4 items, sky active. No floating mic: the mic IS the home screen.
 */
export function AppShell({ children, tabs = true, className }: { children: ReactNode; tabs?: boolean; className?: string }) {
  return (
    <div id="ks-frame" className="ks-frame relative">
      <div className="h-[env(safe-area-inset-top,0px)] shrink-0" />
      <div className={cn('flex min-h-0 flex-1 flex-col', className)}>{children}</div>
      {tabs && <TabBar />}
    </div>
  );
}

function TabBar() {
  const t = useT();
  const item = (to: string, label: string, Icon: typeof BookOpen) => (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => cn('flex flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium', isActive ? 'text-sky' : 'text-ink-2')}>
      {({ isActive }) => (<><Icon className="size-6" strokeWidth={isActive ? 2.1 : 1.7} /> {label}</>)}
    </NavLink>
  );
  return (
    <nav className="relative z-10 grid shrink-0 grid-cols-4 bg-card pb-[max(env(safe-area-inset-bottom),6px)] pt-0.5 shadow-up">
      {item('/', t('Saathi'), Mic)}
      {item('/reminders', t('Reminders'), BellRing)}
      {item('/khata', t('Khata'), BookOpen)}
      {item('/account', t('More'), LayoutGrid)}
    </nav>
  );
}

/**
 * Top-level screen header: the Paytm top bar (shop avatar · wordmark · Search/Bell) plus a line under it. No dark band.
 * - `greeting`: the 13/500 grey line ("Vanakkam, Shanthi Stores · Fri 30 Oct"). Use this on the Saathi home.
 * - `title`: a 22/800 blue screen title (Khata); `subtitle`: 13 grey under it.
 * - `right`: sits at the right of that line (DayChip, an icon button). `topRight` / `topLeft` / `topTitle` override the top bar's slots.
 * - `children`: anything else under the line (a search pill), rendered inside the sky area.
 */
export function HeaderBand({ title, subtitle, greeting, right, topRight, topLeft, topTitle, children, className }: {
  title?: ReactNode; subtitle?: ReactNode; greeting?: ReactNode; right?: ReactNode; topRight?: ReactNode; topLeft?: ReactNode; topTitle?: ReactNode; children?: ReactNode; className?: string;
}) {
  const hasLine = title != null || subtitle != null || greeting != null || right != null;
  return (
    <header className={cn('shrink-0', className)}>
      <TopBar title={topTitle} left={topLeft} right={topRight} />
      {hasLine && (
        <div className="flex items-end justify-between gap-3 px-4 pb-2">
          <div className="min-w-0">
            {greeting != null && <div className="truncate text-[13px] font-medium text-ink-2">{greeting}</div>}
            {title != null && <h1 className="font-display truncate text-[22px] font-extrabold leading-tight text-blue">{title}</h1>}
            {subtitle != null && <div className="mt-0.5 text-[13px] text-ink-2">{subtitle}</div>}
          </div>
          {right != null && <div className="shrink-0">{right}</div>}
        </div>
      )}
      {children != null && <div className="ks-band bg-none px-4 pb-2">{children}</div>}
    </header>
  );
}

/**
 * Compact header: a white bar with a back chevron ("‹ Title") on detail screens and sheets. 56px, title 17/800 blue, centred.
 * `left` / `right` are your own controls (an X, a "Phone" link); `back` renders the default chevron when `left` is not given.
 * `tone` is accepted for compatibility and ignored: there are no navy bands any more.
 */
export function CompactHeader({ title, left, right, back, backTo, subtitle, className }: { title: ReactNode; left?: ReactNode; right?: ReactNode; back?: boolean; backTo?: string; tone?: 'plain' | 'navy'; subtitle?: ReactNode; className?: string }) {
  return (
    <header className={cn('relative z-10 shrink-0 bg-card shadow-card', className)}>
      <TopBar
        title={typeof title === 'string' ? title : <span className="font-display block truncate text-[17px] font-extrabold text-blue">{title}</span>}
        left={left !== undefined ? <span className="flex items-center text-[15px] text-blue-600">{left}</span> : back ? undefined : <span />}
        back={back}
        backTo={backTo}
        right={<span className="flex items-center justify-end text-[15px] text-blue-600">{right}</span>}
      />
      {subtitle != null && <div className="pb-2 text-center text-[12px] text-ink-2">{subtitle}</div>}
    </header>
  );
}

export function Scroll({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto', className)}>{children}</div>;
}

/** A white floating card with an optional title (16/700 blue) and the rows/children unpadded under it. Stacks with 12px gaps in the 16px gutter. */
export function Group({ children, title, subtitle, action, className }: { children: ReactNode; title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('px-4 pt-3', className)}>
      <PaytmCard title={title} subtitle={subtitle} action={action} padded={false}>{children}</PaytmCard>
    </div>
  );
}

/** The date the app thinks it is: today's real date, shifted by the demo clock ("Fri 30 Oct", or "Mon 2 Nov · +3 days"). */
export function demoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + Math.round(offsetDays));
  // Day, date and year only ("Thu, 5 Nov 2026"); the demo offset is applied silently.
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

/** Demo clock chip (PaytmChip style) showing the current demo date; the "+3 days" sky pill appears only where `onForward` is passed. */
export function DayChip({ offsetDays, onForward, onBand, className }: { offsetDays: number | undefined; onForward?: () => void; onBand?: boolean; className?: string }) {
  const t = useT();
  if (offsetDays === undefined) return null;
  return (
    <span className={cn(paytmChipClass(false, onBand ? 'bg-card shadow-card' : undefined), onForward && 'pr-0.5', className)}>
      {demoDate(offsetDays)}
      {onForward && (
        <button type="button" onClick={onForward} aria-label={t('Move time forward 3 days')} className="ml-1 inline-flex h-6 items-center gap-1 rounded-full bg-sky px-2 text-[11px] font-bold text-white active:scale-[0.98]">
          <CalendarPlus className="size-3.5" /> {t('+3 days')}
        </button>
      )}
    </span>
  );
}
