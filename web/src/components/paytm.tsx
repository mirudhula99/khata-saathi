import { createElement, isValidElement, useEffect, type ComponentProps, type ReactElement, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, ChevronLeft, ChevronRight, Search, type LucideIcon } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { initial } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { useKhata } from '@/store/useKhata';
import { useNotifications } from '@/store/useNotifications';

/**
 * Paytm (PODS) primitives for Khata Saathi. Visual contract: .superdesign/paytm-pods-spec.md section 4.
 * Every screen builds from these instead of ad-hoc classes. Nothing here owns behaviour: every handler is passed in.
 */

type Icon = LucideIcon | ReactElement;
const renderIcon = (icon: Icon | undefined, className: string, strokeWidth = 2) =>
  icon == null ? null : isValidElement(icon) ? icon : createElement(icon, { className, strokeWidth, 'aria-hidden': true });

/* ------------------------------------------------------------------ Top bar ------------------------------------- */

/** "Khata Saathi" two-tone wordmark (mirrors pay|tm): "Khata" in --p-blue, "Saathi" in --p-sky. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-display select-none text-[22px] font-extrabold leading-none tracking-[-0.03em]', className)}>
      <span className="text-blue">Khata</span> <span className="text-sky">Saathi</span>
    </span>
  );
}

/** 32px round avatar with the shop initial on --p-blue. Pass a name, or it reads the merchant shop name from the store. */
export function ShopAvatar({ name, className }: { name?: string; className?: string }) {
  const t = useT();
  const shop = useKhata((s) => s.state?.merchant.shop_name ?? '');
  const n = name ?? shop;
  return (
    <span className={cn('font-display grid size-8 shrink-0 place-items-center rounded-full bg-blue text-[14px] font-bold text-white', className)} aria-label={n || t('Shop')}>
      {n ? initial(n) : 'K'}
    </span>
  );
}

/** Round 40px icon button for the top bar: 24px line icon in --p-blue. */
export function TopBarIcon({ icon, label, to, href, onClick, className }: { icon: LucideIcon; label: string; to?: string; href?: string; onClick?: () => void; className?: string }) {
  const cls = cn('grid size-10 place-items-center rounded-full text-blue active:bg-white/60', className);
  const node = renderIcon(icon, 'size-6', 1.8);
  if (to) return <Link to={to} aria-label={label} className={cls}>{node}</Link>;
  if (href) return <a href={href} aria-label={label} className={cls}>{node}</a>;
  return <button type="button" onClick={onClick} aria-label={label} className={cls}>{node}</button>;
}

/** The bell: opens Notifications and wears a count of open tasks plus unseen events. Reloads whenever the khata changes. */
export function NotificationsBell() {
  const t = useT();
  const state = useKhata((s) => s.state);
  const load = useNotifications((s) => s.load);
  const count = useNotifications((s) => s.unreadCount());
  useEffect(() => { void load(); }, [load, state]);
  return (
    <Link to="/notifications" aria-label={count ? t('Notifications, {n} new', { n: count }) : t('Notifications')} className="relative -mr-2 grid size-10 place-items-center rounded-full text-blue active:bg-white/60">
      {renderIcon(Bell, 'size-6', 1.8)}
      {count > 0 && (
        <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-flag px-1 text-[10px] font-bold leading-none text-white ring-2 ring-card">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  );
}

/**
 * Top bar, 56px, transparent so the shell sky gradient shows through.
 * Left: shop avatar (or a back chevron when `back`). Centre: the wordmark, or a plain title. Right: Search + Bell by default.
 * `backTo` makes the chevron go to a route instead of history(-1).
 */
export function TopBar({ title, left, right, back = false, backTo, className }: { title?: ReactNode; left?: ReactNode; right?: ReactNode; back?: boolean; backTo?: string; className?: string }) {
  const t = useT();
  const navigate = useNavigate();
  const leftNode = left !== undefined ? left
    : back ? (
      <button type="button" aria-label={t('Back')} onClick={() => (backTo ? navigate(backTo) : navigate(-1))} className="-ml-2 grid size-10 place-items-center rounded-full text-blue active:bg-white/60">
        <ChevronLeft className="size-6" strokeWidth={2} />
      </button>
    ) : <ShopAvatar />;
  const rightNode = right !== undefined ? right : (
    <>
      <TopBarIcon icon={Search} label={t('Search customers')} to="/khata" />
      <NotificationsBell />
    </>
  );
  return (
    <header className={cn('flex h-14 shrink-0 items-center gap-2 px-4', className)}>
      <div className="flex min-w-0 flex-1 items-center gap-2">{leftNode}</div>
      <div className="flex min-w-0 shrink-0 flex-col items-center">
        {title === undefined || title === null ? <Wordmark /> : typeof title === 'string' ? <span className="font-display block truncate text-[17px] font-extrabold text-blue">{title}</span> : title}
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1">{rightNode}</div>
    </header>
  );
}

/* ------------------------------------------------------------------ Card -------------------------------------------- */

/** The light-grey "Recent ›" style affordance for a card top-right slot. */
export function Affordance({ children, to, onClick, className }: { children?: ReactNode; to?: string; onClick?: () => void; className?: string }) {
  const t = useT();
  const cls = cn('inline-flex items-center gap-0.5 text-[13px] font-medium text-ink-3 active:opacity-70', className);
  const inner = <>{children ?? t('Recent')}<ChevronRight className="size-3.5" strokeWidth={2} /></>;
  if (to) return <Link to={to} className={cls}>{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
  return <span className={cls}>{inner}</span>;
}

/**
 * White card, radius 16, --p-shadow, no border. Header: title 16/700 blue + subtitle 12 grey on the left, `action` on the right.
 * `padded={false}` for cards that hold PaytmRows (rows carry their own 16px padding); the header then pads itself.
 */
export function PaytmCard({ title, subtitle, action, children, padded = true, className, id }: { title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children?: ReactNode; padded?: boolean; className?: string; id?: string }) {
  const header = title != null || subtitle != null || action != null;
  return (
    <section id={id} className={cn('rounded-2xl bg-card shadow-card', padded ? 'p-4' : 'overflow-hidden', className)}>
      {header && (
        <div className={cn('flex items-start justify-between gap-3', padded ? 'mb-3' : 'px-4 pb-2 pt-4')}>
          <div className="min-w-0">
            {title != null && <h2 className="font-display text-[16px] font-bold leading-tight text-blue">{title}</h2>}
            {subtitle != null && <div className="mt-0.5 text-[12px] leading-snug text-ink-2">{subtitle}</div>}
          </div>
          {action != null && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ Icon grid --------------------------------------- */

const TILE_TONE = { blue: 'text-blue', success: 'text-success', muted: 'text-ink-3', warning: 'text-warning' } as const;

/** 4-per-row grid tile: 48px icon area with a 28px line icon, then an 11px two-line centred label. Put inside `grid grid-cols-4 gap-3`. */
export function IconTile({ icon, label, onClick, to, href, target, tone = 'blue', disabled, className, children }: {
  icon: Icon; label: ReactNode; onClick?: () => void; to?: string; href?: string; target?: string; tone?: keyof typeof TILE_TONE; disabled?: boolean; className?: string; children?: ReactNode;
}) {
  const cls = cn('flex flex-col items-center gap-1 rounded-xl text-center active:opacity-70 disabled:opacity-40', className);
  const body = (
    <>
      <span className={cn('relative grid size-12 place-items-center', TILE_TONE[tone])}>
        {renderIcon(icon, 'size-7', 1.6)}
        {children}
      </span>
      <span className="line-clamp-2 text-[11px] font-medium leading-[1.2] text-ink">{label}</span>
    </>
  );
  if (to && !disabled) return <Link to={to} className={cls}>{body}</Link>;
  if (href && !disabled) return <a href={href} target={target} rel={target === '_blank' ? 'noopener' : undefined} className={cls}>{body}</a>;
  return <button type="button" onClick={onClick} disabled={disabled} className={cls}>{body}</button>;
}

/* ------------------------------------------------------------------ Button ------------------------------------------ */

type ButtonVariant = 'primary' | 'dark' | 'outline' | 'ghost';
const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-sky text-white',
  dark: 'bg-blue text-white',
  outline: 'border border-blue-600 bg-card text-blue-600',
  ghost: 'bg-transparent text-blue-600',
};

/** Class string for a pill button, for when the element must be a Link or label. */
export function paytmButtonClass(variant: ButtonVariant = 'primary', size: 'md' | 'sm' = 'md', full = false, className?: string) {
  return cn(
    'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-bold transition-transform duration-150 ease-out active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50',
    size === 'sm' ? 'h-9 px-3.5 text-[13px]' : 'h-11 px-5 text-[15px]',
    full && 'w-full',
    BTN_VARIANT[variant],
    className,
  );
}

/** Pill button: 44px (36 small), radius 999. `primary` sky, `dark` blue, `outline` white with blue-600 border, `ghost` text only. */
export function PaytmButton({ variant = 'primary', size = 'md', full = false, icon, className, children, type = 'button', ...rest }: ComponentProps<'button'> & { variant?: ButtonVariant; size?: 'md' | 'sm'; full?: boolean; icon?: Icon }) {
  return (
    <button type={type} className={paytmButtonClass(variant, size, full, className)} {...rest}>
      {renderIcon(icon, 'size-[18px]')}
      {children}
    </button>
  );
}

/** Same pill as a router Link (for "Open khata", "Record payment" that navigate). */
export function PaytmLinkButton({ variant = 'primary', size = 'md', full = false, icon, className, children, ...rest }: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: 'md' | 'sm'; full?: boolean; icon?: Icon }) {
  return (
    <Link className={paytmButtonClass(variant, size, full, className)} {...rest}>
      {renderIcon(icon, 'size-[18px]')}
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ Chip -------------------------------------------- */

/** Class string for a 28px grey pill chip; selected = sky-tint + sky-ink. */
export function paytmChipClass(selected = false, className?: string) {
  return cn('inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-[12px] font-medium', selected ? 'bg-sky-tint text-sky-ink' : 'bg-chip text-ink-2', className);
}

/** Grey pill chip (like the Paytm UPI ID chip). Renders a button when `onClick` is given, a span otherwise. */
export function PaytmChip({ selected = false, icon, children, onClick, disabled, className, id, 'aria-label': ariaLabel }: { selected?: boolean; icon?: Icon; children: ReactNode; onClick?: () => void; disabled?: boolean; className?: string; id?: string; 'aria-label'?: string }) {
  const inner = <>{renderIcon(icon, 'size-3.5')}{children}</>;
  if (onClick) return <button type="button" id={id} aria-label={ariaLabel} aria-pressed={selected} onClick={onClick} disabled={disabled} className={paytmChipClass(selected, cn('transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-50', className))}>{inner}</button>;
  return <span id={id} aria-label={ariaLabel} className={paytmChipClass(selected, className)}>{inner}</span>;
}

/* ------------------------------------------------------------------ Row --------------------------------------------- */

/** 40px round avatar for rows: sky-tint background, blue initial. */
export function RowAvatar({ name, className, children }: { name: string; className?: string; children?: ReactNode }) {
  return (
    <span className={cn('font-display relative grid size-10 shrink-0 place-items-center rounded-full bg-sky-tint text-[16px] font-bold text-blue', className)} aria-hidden="true">
      {initial(name)}
      {children}
    </span>
  );
}

/**
 * List row, 56px min, hairline between rows (via .p-row, never after the last). Lives inside `<PaytmCard padded={false}>`.
 * `avatar` as a string renders the sky-tint initial; as a node it is placed as-is. Right slot: `right` 15/700 + `rightSub` 12 under it.
 */
export function PaytmRow({ avatar, title, sub, right, rightSub, chevron = false, onClick, to, href, target, disabled, className, id }: {
  avatar?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode; rightSub?: ReactNode; chevron?: boolean; onClick?: () => void; to?: string; href?: string; target?: string; disabled?: boolean; className?: string; id?: string;
}) {
  const interactive = Boolean(onClick || to || href);
  const cls = cn('p-row flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left', interactive && 'active:bg-sky-tint/60', disabled && 'opacity-50', className);
  const body = (
    <>
      {avatar != null && (typeof avatar === 'string' ? <RowAvatar name={avatar} /> : avatar)}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-ink">{title}</span>
        {sub != null && <span className="block truncate text-[13px] text-ink-2">{sub}</span>}
      </span>
      {(right != null || rightSub != null) && (
        <span className="shrink-0 text-right">
          {right != null && <span className="font-display block text-[15px] font-bold text-ink">{right}</span>}
          {rightSub != null && <span className="block text-[12px] text-ink-2">{rightSub}</span>}
        </span>
      )}
      {chevron && <ChevronRight className="size-4 shrink-0 text-ink-3" strokeWidth={2} />}
    </>
  );
  if (to && !disabled) return <Link id={id} to={to} className={cls}>{body}</Link>;
  if (href && !disabled) return <a id={id} href={href} target={target} rel={target === '_blank' ? 'noopener' : undefined} className={cls}>{body}</a>;
  if (onClick) return <button id={id} type="button" onClick={onClick} disabled={disabled} className={cls}>{body}</button>;
  return <div id={id} className={cls}>{body}</div>;
}

/* ------------------------------------------------------------------ Alert ------------------------------------------- */

type AlertTone = 'info' | 'success' | 'warning' | 'error';
const ALERT: Record<AlertTone, { bg: string; bar: string; title: string; icon: string }> = {
  info: { bg: 'bg-info-bg', bar: 'before:bg-info', title: 'text-info-ink', icon: 'text-info' },
  success: { bg: 'bg-success-bg', bar: 'before:bg-success', title: 'text-success-ink', icon: 'text-success' },
  warning: { bg: 'bg-warning-bg', bar: 'before:bg-warning', title: 'text-warning-ink', icon: 'text-warning' },
  error: { bg: 'bg-error-bg', bar: 'before:bg-error', title: 'text-error-ink', icon: 'text-error' },
};

/**
 * Pastel alert strip: radius 12, 4px left bar in the semantic colour, title 14/600, text 13.
 * `compact` makes a one-line strip (demo notice). `action` renders under the text (pill buttons, links).
 */
export function PaytmAlert({ tone = 'info', title, children, action, icon, compact = false, className, id }: { tone?: AlertTone; title?: ReactNode; children?: ReactNode; action?: ReactNode; icon?: Icon; compact?: boolean; className?: string; id?: string }) {
  const t = ALERT[tone];
  return (
    <div id={id} role={tone === 'error' ? 'alert' : undefined} className={cn('relative overflow-hidden rounded-xl pl-4 pr-3 before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-[""]', t.bg, t.bar, compact ? 'py-1.5' : 'py-3', className)}>
      <div className={cn('flex gap-2', compact ? 'items-center' : 'items-start')}>
        {icon != null && <span className={cn('shrink-0', t.icon, compact ? '' : 'pt-0.5')}>{renderIcon(icon, compact ? 'size-3.5' : 'size-[18px]', 1.8)}</span>}
        <div className="min-w-0 flex-1">
          {title != null && <div className={cn('font-semibold leading-snug', compact ? 'text-[12px]' : 'text-[14px]', t.title)}>{title}</div>}
          {children != null && <div className={cn('leading-snug text-ink', compact ? 'text-[12px]' : 'text-[13px]', title != null && !compact && 'mt-0.5')}>{children}</div>}
        </div>
      </div>
      {action != null && <div className="mt-2.5 flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ Summary banner ---------------------------------- */

/** The pending-money summary as a Paytm-style pastel gradient card. `amount` is the headline ("₹1,240 pending"), `caption` the line under it. */
export function SummaryBanner({ amount, caption, to, cta, className }: { amount: ReactNode; caption?: ReactNode; to: string; cta?: ReactNode; className?: string }) {
  const t = useT();
  return (
    <Link to={to} className={cn('p-promo-gradient flex items-center justify-between gap-3 rounded-2xl p-4 shadow-card active:opacity-80', className)}>
      <span className="min-w-0">
        <span className="font-display ks-xfade block text-[22px] font-extrabold leading-tight text-blue">{amount}</span>
        {caption != null && <span className="mt-0.5 block text-[13px] text-ink-2">{caption}</span>}
      </span>
      <span className={paytmButtonClass('dark', 'sm', false, 'h-8 px-3.5 text-[12px]')}>{cta ?? t('Open khata')}<ChevronRight className="size-3.5" strokeWidth={2.4} /></span>
    </Link>
  );
}

/* ------------------------------------------------------------------ Sheet bits -------------------------------------- */

/** 36x4 grey grabber for the top of a sheet. */
export function Grabber({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('mx-auto mb-1 mt-2 h-1 w-9 rounded-full bg-[#d0d5dd]', className)} />;
}

/** Sheet / dialog title: 18/800 blue. */
export function SheetHeading({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn('font-display text-[18px] font-extrabold leading-tight text-blue', className)}>{children}</h2>;
}

/* ------------------------------------------------------------------ Badge ------------------------------------------- */

type BadgeTone = 'sky' | 'success' | 'warning' | 'error' | 'grey';
const BADGE: Record<BadgeTone, string> = {
  sky: 'bg-sky-tint text-sky-ink',
  success: 'bg-success-bg text-success-ink',
  warning: 'bg-warning-bg text-warning-ink',
  error: 'bg-error-bg text-error-ink',
  grey: 'bg-chip text-ink-2',
};

/** Tiny status pill, 11/600. StatusChip maps its kinds onto these tones. */
export function PaytmBadge({ tone = 'grey', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4', BADGE[tone], className)}>{children}</span>;
}
