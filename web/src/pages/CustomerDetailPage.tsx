import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bell, CheckCircle2, ChevronDown, ChevronLeft, CirclePause, CirclePlay, HandCoins, IndianRupee, Link2, PenLine, Send, ShoppingBasket, Smartphone, Undo2 } from 'lucide-react';

/** History rows shown before a "Show N more" step, so a regular's twenty entries don't make the screen endless. */
const HISTORY_PAGE = 5;
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { AppShell, CompactHeader, Scroll } from '@/components/AppShell';
import { Affordance, IconTile, PaytmAlert, PaytmButton, PaytmCard, PaytmChip, PaytmRow, RowAvatar } from '@/components/paytm';
import { StatusChip } from '@/components/StatusChip';
import { api } from '@/lib/api';
import { LANGS } from '@/lib/speech';
import type { CustomerDetail, Entry } from '@/lib/types';
import { dateTime, timeAgo } from '@/lib/ui';
import { cn, inr } from '@/lib/utils';
import { useKhata } from '@/store/useKhata';

/**
 * Customer detail, Paytm edition (spec section 5): compact header (back chevron, name, Phone link) → hero card with the
 * 32/800 amount, a "pending · 40 days" chip and the 4-tile grid (Remind, Record payment, Customer's phone, Pause/Resume;
 * "Add udhaar ›" is the card's affordance) → flagged entries as error alerts → "History" rows (verified green, cash grey) →
 * "WhatsApp and reminders" rows (consent, pause, language, number). "Clear repayment history, no black-box score."
 */
export function CustomerDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const cid = Number(id);
  const navigate = useNavigate();
  const { state, doneSeq, remindNow, patchCustomer, resolveDispute } = useKhata();
  const [c, setC] = useState<CustomerDetail | null>(null);
  const [err, setErr] = useState('');
  const [historyShown, setHistoryShown] = useState(HISTORY_PAGE);
  const [phone, setPhone] = useState('');

  useEffect(() => {
    let live = true;
    api.customer(cid).then((d) => { if (live) { setC(d); setPhone(d.phone ?? ''); setErr(''); } }).catch((e) => { if (live) setErr(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, [cid, state, doneSeq]);

  const back = <Link to="/khata" className="-ml-2 inline-flex h-11 items-center pr-2 font-semibold active:opacity-70"><ChevronLeft className="size-6" strokeWidth={2} /> Khata</Link>;
  if (err) return <AppShell><CompactHeader title="Customer" left={back} /><div className="p-6 text-center text-[13px] text-ink-2">{err}</div></AppShell>;
  if (!c) return <AppShell><CompactHeader title="Customer" left={back} /></AppShell>;

  const s = c.stats;
  const habit = s.avg_days_to_clear != null ? `Usually pays back in about ${Math.round(s.avg_days_to_clear)} days (${s.credits_cleared} cleared).` : 'No repayment history yet.';
  const disputed = c.entries.filter((e) => e.status === 'disputed');
  const canRemind = c.balance > 0 && c.consent === 'granted' && disputed.length === 0;
  const remindHint = c.consent !== 'granted' ? 'Needs WhatsApp consent' : disputed.length ? 'Resolve the flagged entry first' : '';
  const meta = [c.note, c.phone, LANGS.find((l) => l.code === c.language)?.label].filter(Boolean).join(' · ');

  return (
    <AppShell>
      <CompactHeader title={c.name} left={back} right={<a href={`/customer?id=${c.id}`} target="_blank" rel="noopener" className="-mr-2 inline-flex h-11 items-center gap-1 pl-2 font-semibold active:opacity-70"><Smartphone className="size-5" strokeWidth={1.8} /> Phone</a>} />
      <Scroll className="pb-6">
        <div className="flex flex-col gap-3 px-4 pt-3">
          {/* Hero: who, how much, since when, and the four actions. */}
          <PaytmCard>
            <div className="flex items-center gap-3">
              <RowAvatar name={c.name} className="size-14 text-[22px]" />
              <div className="min-w-0 flex-1">
                <div className="font-display truncate text-[18px] font-extrabold leading-tight text-blue">{c.name}</div>
                {meta && <div className="truncate text-[12px] text-ink-2">{meta}</div>}
              </div>
              <Affordance to={`/add?customer=${c.id}`} className="-my-2 min-h-11 px-1"><PenLine className="size-3.5" strokeWidth={2} /> Add udhaar</Affordance>
            </div>
            <div className="mt-4 flex flex-col items-center gap-2 text-center">
              {c.balance > 0 ? (
                <>
                  <div className="font-display ks-xfade text-[32px] font-extrabold leading-none tabular-nums text-owed" key={c.balance}>{inr(c.balance)}</div>
                  <PaytmChip selected>pending{s.oldest_unpaid_days ? ` · ${s.oldest_unpaid_days} days` : ''}</PaytmChip>
                </>
              ) : (
                /* Settled: one quiet line instead of a hero amount. The big number is for money that is still out. */
                <div className="ks-xfade flex items-center gap-2 text-[15px] font-semibold text-paid" key="settled">
                  <CheckCircle2 className="size-5" strokeWidth={2} aria-hidden="true" /> Paid up · nothing pending
                </div>
              )}
              <p className={cn('text-[13px] text-ink-2', c.balance <= 0 && '-mt-1')}>{habit}</p>
              {(c.consent !== 'granted' || c.reminders_paused || disputed.length > 0) && (
                <div className="flex flex-wrap justify-center gap-1.5">
                  {c.consent === 'pending' && <StatusChip kind="noConsent" />}
                  {c.consent === 'opted_out' && <StatusChip kind="optedOut" />}
                  {c.reminders_paused && <StatusChip kind="paused" />}
                  {disputed.length > 0 && <StatusChip kind="flagged" />}
                </div>
              )}
            </div>
            <div className="mt-4 grid grid-cols-4 gap-3">
              <div title={remindHint || undefined}>
                <IconTile icon={Bell} label="Remind now" disabled={!canRemind} onClick={() => void remindNow(c.id)} />
              </div>
              <IconTile icon={HandCoins} label="Record payment" disabled={c.balance <= 0} onClick={() => navigate(`/khata/${c.id}/settle`)} />
              <IconTile icon={Smartphone} label={<>Customer&apos;s phone</>} href={`/customer?id=${c.id}`} target="_blank" />
              <IconTile
                icon={c.reminders_paused ? CirclePlay : CirclePause}
                label={c.reminders_paused ? 'Resume reminders' : 'Pause reminders'}
                onClick={() => void patchCustomer(c.id, { reminders_paused: !c.reminders_paused })}
              />
            </div>
            {!canRemind && remindHint && <p className="mt-2 text-center text-[11px] text-ink-3">Remind: {remindHint.toLowerCase()}.</p>}
          </PaytmCard>

          {disputed.map((e) => (
            <PaytmAlert
              key={e.id}
              tone="error"
              title={<>{c.name} says the {inr(e.amount)} entry{e.items.length ? ` (${e.items.join(', ')})` : ''} is wrong.</>}
              action={
                <>
                  <PaytmButton variant="outline" size="sm" onClick={() => void resolveDispute(e.id, 'keep')}>Keep entry</PaytmButton>
                  <PaytmButton variant="dark" size="sm" onClick={() => void resolveDispute(e.id, 'remove')}>Remove entry</PaytmButton>
                </>
              }
            >
              Left out of the balance until you decide. Reminders pause meanwhile.
            </PaytmAlert>
          ))}

          <PaytmCard padded={false} title="History" subtitle={`The actual record · ${c.entries.length} ${c.entries.length === 1 ? 'entry' : 'entries'} · no score, you decide`}>
            {c.entries.length === 0 && <div className="px-4 pb-4 pt-1 text-[13px] text-ink-2">No entries yet.</div>}
            {/* Newest entries first; the rest behind "Show more" so the screen ends after the actions and a short record. */}
            {c.entries.slice(0, historyShown).map((e) => <EntryLine key={e.id} e={e} />)}
            {c.entries.length > historyShown && (
              <button type="button" onClick={() => setHistoryShown((n) => n + HISTORY_PAGE)} className="flex h-12 w-full items-center justify-center gap-1 border-t border-line text-[14px] font-semibold text-sky-ink active:bg-chip">
                Show {Math.min(c.entries.length - historyShown, HISTORY_PAGE)} more <ChevronDown className="size-4" strokeWidth={2} />
              </button>
            )}
          </PaytmCard>

          <PaytmCard padded={false} title="WhatsApp and reminders" subtitle="Polite messages from your shop, on your schedule">
            <PaytmRow
              title={<label htmlFor="consent" className="cursor-pointer">Agreed to WhatsApp updates</label>}
              right={<Switch id="consent" checked={c.consent === 'granted'} onCheckedChange={(v) => void patchCustomer(c.id, { consent: v ? 'granted' : c.consent === 'opted_out' ? 'opted_out' : 'pending' })} />}
            />
            <PaytmRow
              title={<label htmlFor="paused" className="cursor-pointer">Pause reminders</label>}
              right={<Switch id="paused" checked={c.reminders_paused} onCheckedChange={(v) => void patchCustomer(c.id, { reminders_paused: v })} />}
            />
            <PaytmRow
              title="Message language"
              right={
                <Select value={c.language} onValueChange={(v) => void patchCustomer(c.id, { language: v })}>
                  <SelectTrigger aria-label="Message language" className="font-sans"><SelectValue /></SelectTrigger>
                  <SelectContent align="end">{LANGS.map((l) => <SelectItem key={l.code} value={l.code}>{l.native}</SelectItem>)}</SelectContent>
                </Select>
              }
            />
            <form className="p-row flex min-h-14 items-center gap-3 px-4 py-2" onSubmit={(e) => { e.preventDefault(); void patchCustomer(c.id, { phone }); }}>
              <label htmlFor="phone" className="shrink-0 text-[15px] font-semibold text-ink">WhatsApp number</label>
              <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" className="h-11 min-w-0 flex-1 rounded-full bg-chip px-3.5 text-right text-[14px] tabular-nums text-ink outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-sky" />
              {phone !== (c.phone ?? '') && <PaytmButton type="submit" variant="ghost" size="sm" className="-mr-2 px-2">Save</PaytmButton>}
            </form>
            {c.next_reminder_at && c.balance > 0 && <div className="px-4 pb-3 pt-1 text-[12px] text-ink-2">Next reminder: {dateTime(c.next_reminder_at) || 'scheduled'}.</div>}
          </PaytmCard>
        </div>
      </Scroll>
    </AppShell>
  );
}

/**
 * History row (spec section 5): PaytmRow with a tinted icon circle. Verified Paytm payments read green with a "Verified"
 * badge; cash notes read grey with a "Cash" badge, so the difference shows without reading. Udhaar amber; reversal grey.
 */
function EntryLine({ e }: { e: Entry }) {
  const verified = e.type === 'repayment' && (e.source === 'mock' || e.source === 'paytm');
  const cash = e.type === 'repayment' && !verified;
  const Icon = e.type === 'credit' ? ShoppingBasket : e.type === 'reversal' ? Undo2 : e.type === 'adjustment' ? PenLine : verified ? IndianRupee : e.type === 'cash_sale' ? Link2 : HandCoins;
  const iconCls = e.type === 'credit' ? 'bg-warning-bg text-warning' : e.type === 'reversal' || e.type === 'adjustment' ? 'bg-chip text-ink-3' : verified ? 'bg-success-bg text-success' : 'bg-chip text-ink-2';
  const title = e.type === 'credit' ? `${inr(e.amount)}${e.items.length ? ' · ' + e.items.join(', ') : ' · udhaar'}`
    : e.type === 'repayment' ? `−${inr(e.amount)} · ${verified ? (e.source === 'paytm' ? 'Paytm' : 'payment link') : 'cash'}`
    : e.type === 'cash_sale' ? `${inr(e.amount)} · cash sale`
    : e.type === 'adjustment' ? `${e.change > 0 ? '+' : '−'}${inr(e.amount)} · balance corrected` : `${inr(e.amount)} · entry removed`;
  const sub = [timeAgo(e.created_at), e.status === 'disputed' ? 'customer says wrong' : e.customer_ack === 'ack' ? 'confirmed by customer' : e.customer_ack === 'kept' ? 'flagged, kept by you' : e.customer_ack === 'removed' ? 'flagged, removed' : e.source === 'voice' ? 'by voice' : ''].filter(Boolean).join(' · ');
  const badge = e.status === 'disputed' ? <StatusChip kind="flagged" /> : verified ? <StatusChip kind="verified" /> : cash ? <StatusChip kind="cashNoted" /> : e.type === 'reversal' ? <StatusChip kind="removed" /> : null;
  return (
    <PaytmRow
      avatar={<span className={cn('grid size-10 shrink-0 place-items-center rounded-full', iconCls)}><Icon className="size-5" strokeWidth={1.8} aria-hidden="true" /></span>}
      title={<span className={cn('tabular-nums', verified && 'text-paid', cash && 'text-ink', e.type === 'reversal' && 'text-ink-2')}>{title}</span>}
      sub={sub || undefined}
      right={e.type === 'credit' && e.customer_ack === 'ack' ? <Send className="ml-auto size-4 text-success" aria-label="Confirmed" /> : undefined}
      rightSub={badge ?? undefined}
    />
  );
}
