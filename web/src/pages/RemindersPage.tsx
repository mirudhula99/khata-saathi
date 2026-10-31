import { useEffect, useState } from 'react';
import { Bell, MessageCircle, Pause, PenLine, Play, Smartphone } from 'lucide-react';
import { AppShell, HeaderBand, Scroll } from '@/components/AppShell';
import { Affordance, PaytmAlert, PaytmButton, PaytmCard, PaytmRow, paytmButtonClass } from '@/components/paytm';
import { ReminderMessageSheet } from '@/components/ReminderMessageSheet';
import { StatusChip } from '@/components/StatusChip';
import { api } from '@/lib/api';
import type { CustomerRowData } from '@/lib/types';
import { cn, inr } from '@/lib/utils';
import { useKhata } from '@/store/useKhata';

/**
 * Reminders (spec section 5): top bar → Card "Demo clock" (date, +3 days, Run reminders now) → Card "Reminder queue"
 * with a row per customer (schedule, paused / opted-out badges) and the actual message as a PaytmAlert(info) when expanded.
 * The longest-pending customer's message starts expanded, so the preview is visible without a tap (as it always was).
 * Server rules (app/services.py): consent required, one per MIN_HOURS_BETWEEN_REMINDERS, quiet hours 9 to 20 IST,
 * paused or disputed customers skipped, stops at zero balance. Never a red "overdue" banner.
 */
export function RemindersPage() {
  const { state, remindNow, patchCustomer } = useKhata();
  const owing = (state?.customers ?? []).filter((c) => c.balance > 0).sort((a, b) => b.days - a.days);
  const [rules, setRules] = useState(false);
  // The real message text per customer (their language, their note), from the server. One line shows under each row.
  const [previews, setPreviews] = useState<Record<number, string>>({});
  const [editing, setEditing] = useState<CustomerRowData | null>(null);
  const ids = owing.map((c) => c.id).join(',');
  useEffect(() => {
    let alive = true;
    owing.forEach((c) => { api.reminderPreview(c.id).then((p) => { if (alive) setPreviews((m) => ({ ...m, [c.id]: p.text })); }).catch(() => undefined); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, state]);
  const firstLine = (c: CustomerRowData) => (previews[c.id] ?? '').split('\n')[0] || 'Loading message…';
  const why = (c: CustomerRowData) => c.consent !== 'granted' ? (c.consent === 'opted_out' ? 'stopped by customer' : 'no WhatsApp consent yet') : c.reminders_paused ? 'paused by you' : c.disputes ? 'waiting on a flagged entry' : 'on schedule';
  const badge = (c: CustomerRowData) => c.consent === 'opted_out' ? <StatusChip kind="optedOut" /> : c.consent === 'pending' ? <StatusChip kind="noConsent" /> : c.reminders_paused ? <StatusChip kind="paused" /> : c.disputes ? <StatusChip kind="flagged" /> : null;

  return (
    <AppShell>
      {/* Clean title and one quiet line. The date lives on the home greeting (and under More → Demo clock when shifted). */}
      <HeaderBand title="Reminders" subtitle="Polite nudges on WhatsApp, in the customer's language." />
      <Scroll className="pb-6">
        <div className="flex flex-col gap-3 px-4 pt-1">
          <PaytmCard
            padded={false}
            title="Reminder queue"
            subtitle={owing.length ? `${owing.length} ${owing.length === 1 ? 'customer' : 'customers'} with udhaar pending` : 'Who gets reminded, and the message they get'}
            action={<Affordance onClick={() => setRules((r) => !r)}>{rules ? 'Hide rules' : 'How it works'}</Affordance>}
          >
            {rules && (
              <div className="px-4 pb-3">
                <PaytmAlert tone="info" title="Guardrails">
                  Needs the customer's consent. At most one reminder a day, only 9am to 8pm. Pauses while an entry is flagged. Stops the moment the balance is zero. The customer can reply STOP.
                </PaytmAlert>
              </div>
            )}
            {owing.length === 0 && <div className="px-4 pb-4 text-[13px] text-ink-2">Nobody owes anything. Nothing to remind.</div>}
            {owing.map((c, i) => (
                <div key={c.id} className={cn(i > 0 && 'border-t border-line')}>
                  <PaytmRow
                    avatar={c.name}
                    title={<span className="flex items-center gap-1.5"><span className="truncate">{c.name}</span>{badge(c)}</span>}
                    sub={`${c.days} days · ${why(c)}`}
                    right={<span className="text-owed">{inr(c.balance)}</span>}
                    to={`/khata/${c.id}`}
                  />
                  {/* One line of the actual message, and a pen to add the merchant's own line. Tap either to open the editor. */}
                  <button type="button" onClick={() => setEditing(c)} aria-label={`Edit the reminder message for ${c.name}`}
                    className="flex w-full items-center gap-2 px-4 pb-2 text-left active:opacity-70">
                    <MessageCircle className="size-4 shrink-0 text-sky-ink" strokeWidth={1.8} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{firstLine(c)}</span>
                    {c.reminder_note && <span className="shrink-0 rounded-full bg-sky-tint px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-ink">your line</span>}
                    <span className="grid size-9 shrink-0 place-items-center rounded-full text-blue"><PenLine className="size-[18px]" strokeWidth={1.8} aria-hidden="true" /></span>
                  </button>
                  {/* 44px tap targets (design-system: never under 44) with the small pill's 13px label so all three fit on one line. */}
                  <div className="flex items-center gap-2 px-4 pb-3">
                    <PaytmButton variant="primary" size="sm" className="h-11" icon={Bell} disabled={c.consent !== 'granted' || c.disputes > 0} onClick={() => void remindNow(c.id)}>Remind now</PaytmButton>
                    <PaytmButton variant="outline" size="sm" className="h-11" icon={c.reminders_paused ? Play : Pause} onClick={() => void patchCustomer(c.id, { reminders_paused: !c.reminders_paused })}>{c.reminders_paused ? 'Resume' : 'Pause'}</PaytmButton>
                    <a href={`/customer?id=${c.id}`} target="_blank" rel="noopener" aria-label="Open customer's phone" className={paytmButtonClass('ghost', 'sm', false, 'ml-auto size-11 px-0')}><Smartphone className="size-[18px]" strokeWidth={1.8} /></a>
                  </div>
                </div>
            ))}
          </PaytmCard>
        </div>
        <ReminderMessageSheet customer={editing} open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null); }} />
      </Scroll>
    </AppShell>
  );
}
