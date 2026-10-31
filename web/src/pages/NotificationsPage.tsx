import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, CalendarClock, CheckCheck, Flag, HandCoins, IndianRupee, MessageCircleOff, PauseCircle, PhoneOff, UserPlus, UserRoundCheck, type LucideIcon } from 'lucide-react';
import { AppShell, CompactHeader, Scroll } from '@/components/AppShell';
import { PaytmButton, PaytmCard, PaytmChip, PaytmLinkButton } from '@/components/paytm';
import type { Notification, NotificationCategory } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useKhata } from '@/store/useKhata';
import { useNotifications } from '@/store/useNotifications';

/**
 * Notifications (the bell). Product intent: the shopkeeper's "what needs me, and what happened" in one place,
 * derived from the khata itself, never typed in. Needs-action tasks are pinned on top while they hold; events
 * (money in, reminders out, customers joining) follow, newest first. Filters narrow by category. Tapping a row
 * opens the customer. Reminders (the tab) is the outbound schedule; this is the inbound side.
 */
type Filter = 'all' | NotificationCategory;

const ICON: Record<string, { icon: LucideIcon; tone: string }> = {
  flagged: { icon: Flag, tone: 'bg-flag/10 text-flag' },
  balance_flagged: { icon: Flag, tone: 'bg-flag/10 text-flag' },
  unpaid_after_reminder: { icon: BellRing, tone: 'bg-owed/10 text-owed' },
  no_consent: { icon: PhoneOff, tone: 'bg-owed/10 text-owed' },
  opted_out: { icon: MessageCircleOff, tone: 'bg-chip text-ink-2' },
  paused: { icon: PauseCircle, tone: 'bg-chip text-ink-2' },
  payment: { icon: IndianRupee, tone: 'bg-paid/10 text-paid' },
  cash: { icon: HandCoins, tone: 'bg-chip text-ink-2' },
  reminder_sent: { icon: BellRing, tone: 'bg-sky-tint text-blue' },
  reminder_due: { icon: CalendarClock, tone: 'bg-sky-tint text-blue' },
  joined: { icon: UserRoundCheck, tone: 'bg-paid/10 text-paid' },
  new_customer: { icon: UserPlus, tone: 'bg-sky-tint text-blue' },
};

/** "2h ago", "3d ago", "due today", or a short date. */
function when(iso: string, now: Date): string {
  const t = new Date(iso);
  const diff = (t.getTime() - now.getTime()) / 1000;
  if (diff > 60) return diff < 36 * 3600 ? (diff < 12 * 3600 ? 'today' : 'tomorrow') : t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const ago = -diff;
  if (ago < 3600) return `${Math.max(1, Math.round(ago / 60))}m ago`;
  if (ago < 86400) return `${Math.round(ago / 3600)}h ago`;
  if (ago < 7 * 86400) return `${Math.round(ago / 86400)}d ago`;
  return t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function dayKey(iso: string, now: Date): 'Today' | 'Yesterday' | 'Earlier' {
  const d = new Date(iso), n = new Date(now);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, n) || d > n) return 'Today';
  n.setDate(n.getDate() - 1);
  return same(d, n) ? 'Yesterday' : 'Earlier';
}

export function NotificationsPage() {
  const state = useKhata((s) => s.state);
  const { items, counts, loaded, load, markAllRead, isUnread } = useNotifications();
  const [filter, setFilter] = useState<Filter>('all');
  useEffect(() => { void load(); }, [load, state]);
  // Opening the page marks events as seen once they have been shown (on leave), so the dots stay while you read.
  useEffect(() => () => markAllRead(), [markAllRead]);

  const now = new Date();
  const shown = items.filter((n) => filter === 'all' || n.category === filter);
  const actions = shown.filter((n) => n.category === 'action');
  const events = shown.filter((n) => n.category !== 'action');
  const groups = (['Today', 'Yesterday', 'Earlier'] as const).map((k) => ({ k, rows: events.filter((n) => dayKey(n.at, now) === k) })).filter((g) => g.rows.length);
  const chip = (f: Filter, label: string, count?: number) => (
    <PaytmChip selected={filter === f} onClick={() => setFilter(f)} className="h-9 px-3.5 text-[13px]">{label}{count ? ` · ${count}` : ''}</PaytmChip>
  );

  const Row = ({ n }: { n: Notification }) => {
    const meta = ICON[n.kind] ?? { icon: BellRing, tone: 'bg-chip text-ink-2' };
    const Icon = meta.icon;
    const inner: ReactNode = (
      <>
        <span className={cn('relative grid size-10 shrink-0 place-items-center rounded-full', meta.tone)} aria-hidden="true">
          <Icon className="size-5" strokeWidth={1.8} />
          {isUnread(n) && <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-card bg-sky" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={cn('truncate text-[15px] text-ink', n.urgent ? 'font-bold' : 'font-semibold')}>{n.title}</span>
            <span className="shrink-0 text-[11px] text-ink-3">{when(n.at, now)}</span>
          </span>
          <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">{n.body}</span>
          {n.action && (
            <span className="mt-2 block">
              <PaytmLinkButton to={n.action.to} variant={n.urgent ? 'dark' : 'outline'} size="sm">{n.action.label}</PaytmLinkButton>
            </span>
          )}
        </span>
      </>
    );
    const cls = 'flex w-full items-start gap-3 px-4 py-3 text-left active:bg-chip';
    return n.customer_id ? <Link to={`/khata/${n.customer_id}`} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>;
  };

  return (
    <AppShell>
      <CompactHeader title="Notifications" tone="plain" left={<Link to="/" className="-ml-2 inline-flex h-11 items-center pr-2 font-semibold text-blue active:opacity-70">‹ Home</Link>}
        right={events.length > 0 ? <PaytmButton variant="ghost" size="sm" icon={CheckCheck} onClick={markAllRead}>Mark read</PaytmButton> : undefined} />
      <Scroll className="pb-6">
        <div className="flex flex-col gap-3 px-4 pt-2">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" style={{ scrollbarWidth: 'none' }}>
            {chip('all', 'All')}
            {chip('action', 'Needs you', counts.action)}
            {chip('payments', 'Money in', counts.payments)}
            {chip('reminders', 'Reminders', counts.reminders)}
            {chip('customers', 'Customers', counts.customers)}
          </div>

          {!loaded && <div className="h-24 animate-pulse rounded-2xl bg-chip" aria-hidden="true" />}

          {loaded && (filter === 'all' || filter === 'action') && (
            <PaytmCard padded={false} title="Needs you" subtitle={actions.length ? `${actions.length} ${actions.length === 1 ? 'thing' : 'things'} to look at` : 'Nothing waiting on you'}>
              {actions.length === 0 && <div className="px-4 pb-4 text-[13px] text-ink-2">Flagged entries, silent customers after reminders, and people you can't remind show up here.</div>}
              {actions.map((n, i) => <div key={n.id} className={cn(i > 0 && 'border-t border-line')}><Row n={n} /></div>)}
            </PaytmCard>
          )}

          {loaded && groups.map((g) => (
            <PaytmCard key={g.k} padded={false} title={g.k}>
              {g.rows.map((n, i) => <div key={n.id} className={cn(i > 0 && 'border-t border-line')}><Row n={n} /></div>)}
            </PaytmCard>
          ))}
          {loaded && events.length === 0 && filter !== 'action' && (
            <p className="px-2 text-center text-[13px] text-ink-2">No {filter === 'all' ? 'activity' : filter === 'payments' ? 'payments' : filter} in the last two weeks.</p>
          )}
          <p className="px-2 pt-1 text-center text-[12px] text-ink-2">Everything here comes from the khata itself. Nothing to tidy, nothing to type.</p>
        </div>
      </Scroll>
    </AppShell>
  );
}
