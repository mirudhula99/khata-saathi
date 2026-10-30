import { useState } from 'react';
import { Bell, MessageCircle, Pause, Play, Smartphone } from 'lucide-react';
import { AppShell, HeaderBand, Scroll } from '@/components/AppShell';
import { Affordance, PaytmAlert, PaytmButton, PaytmCard, PaytmRow, paytmButtonClass } from '@/components/paytm';
import { StatusChip } from '@/components/StatusChip';
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
  const shop = state?.merchant.shop_name ?? 'the shop';
  // undefined = "nothing tapped yet" → the first customer's message shows; null = everything collapsed by the merchant.
  const [open, setOpen] = useState<number | null | undefined>(undefined);
  const [rules, setRules] = useState(false);
  const openId = open === undefined ? owing[0]?.id ?? null : open;

  // Mirrors app/i18n.py reminder_1 (en-IN). The real message goes out in the customer's own language.
  const preview = (c: CustomerRowData) => `Hi ${c.name}, a friendly reminder from ${shop}: ${inr(c.balance)} is due. Pay here: [payment link]\nReply STOP to stop reminders.`;
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
            {owing.map((c, i) => {
              const expanded = openId === c.id;
              return (
                <div key={c.id} className={cn(i > 0 && 'border-t border-line')}>
                  <PaytmRow
                    avatar={c.name}
                    title={<span className="flex items-center gap-1.5"><span className="truncate">{c.name}</span>{badge(c)}</span>}
                    sub={`${c.days} days · ${why(c)}`}
                    right={<span className="text-owed">{inr(c.balance)}</span>}
                    rightSub={<span className="text-sky-ink">{expanded ? 'Hide message' : 'Show message'}</span>}
                    onClick={() => setOpen(expanded ? null : c.id)}
                  />
                  {expanded && (
                    <div className="px-4 pb-3">
                      <PaytmAlert tone="info" icon={MessageCircle} title="What they get on WhatsApp">
                        <span className="whitespace-pre-wrap">{preview(c)}</span>
                      </PaytmAlert>
                    </div>
                  )}
                  {/* 44px tap targets (design-system: never under 44) with the small pill's 13px label so all three fit on one line. */}
                  <div className="flex items-center gap-2 px-4 pb-3">
                    <PaytmButton variant="primary" size="sm" className="h-11" icon={Bell} disabled={c.consent !== 'granted' || c.disputes > 0} onClick={() => void remindNow(c.id)}>Remind now</PaytmButton>
                    <PaytmButton variant="outline" size="sm" className="h-11" icon={c.reminders_paused ? Play : Pause} onClick={() => void patchCustomer(c.id, { reminders_paused: !c.reminders_paused })}>{c.reminders_paused ? 'Resume' : 'Pause'}</PaytmButton>
                    <a href={`/customer?id=${c.id}`} target="_blank" rel="noopener" aria-label="Open customer's phone" className={paytmButtonClass('ghost', 'sm', false, 'ml-auto size-11 px-0')}><Smartphone className="size-[18px]" strokeWidth={1.8} /></a>
                  </div>
                </div>
              );
            })}
          </PaytmCard>
        </div>
      </Scroll>
    </AppShell>
  );
}
