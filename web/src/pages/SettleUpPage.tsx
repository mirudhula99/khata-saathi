import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { HandCoins, Link2, X } from 'lucide-react';
import { AppShell, CompactHeader, Scroll } from '@/components/AppShell';
import { PaytmAlert, PaytmButton, PaytmCard, PaytmChip, RowAvatar } from '@/components/paytm';
import { PendingCard } from '@/components/PendingCard';
import { WhichCustomerDialog } from '@/components/WhichCustomerDialog';
import { cn, inr } from '@/lib/utils';
import { useKhata } from '@/store/useKhata';

/**
 * Record payment (spec section 5, "Record payment"): a sheet-style page. Amount input (Manrope 32/800 with a leading ₹),
 * live "₹300 of ₹800 · ₹500 left" as a PaytmAlert(info), segmented chips Paytm link | Cash, full-width primary pill.
 * Both go through /api/command as the sentence the merchant would have said, so Saathi reads it back first.
 * A link payment closes udhaar only when the verified payment event arrives; cash is recorded after the merchant's yes.
 */
export function SettleUpPage() {
  const { id = '' } = useParams<{ id: string }>();
  const cid = Number(id);
  const navigate = useNavigate();
  const { state, pending, lastDone, doneSeq, command, loading } = useKhata();
  const c = state?.customers.find((x) => x.id === cid);
  const balance = c?.balance ?? 0;
  const [amount, setAmount] = useState<string>(String(balance || ''));
  const [method, setMethod] = useState<'link' | 'cash'>('link');
  const [sent, setSent] = useState<number | null>(null);
  useEffect(() => { if (!amount && balance) setAmount(String(balance)); }, [balance, amount]);
  const n = Math.max(0, Number(amount) || 0);
  const left = Math.max(0, balance - n);
  const valid = n > 0 && n <= balance + 0.001;
  const tooMuch = !valid && n > 0;

  // After the merchant's yes (doneSeq moved past the value we noted), go back to the customer.
  useEffect(() => { if (sent != null && doneSeq > sent && lastDone) navigate(`/khata/${cid}`, { replace: true }); }, [doneSeq, sent, lastDone, navigate, cid]);

  const go = async () => {
    if (!c || !valid) return;
    setSent(doneSeq);
    // This page already knows the customer, so its id goes with the sentence: the server never matches by name,
    // and a payment can't land on the other Ramesh.
    await command(method === 'cash' ? `${c.name} paid ${n} cash` : `Ask ${c.name} for ${n}`, cid);
  };

  const quick = [balance, Math.round(balance / 2), 100].filter((v, i, a) => v > 0 && v <= balance && a.indexOf(v) === i);
  const methods: { value: 'link' | 'cash'; label: string }[] = [{ value: 'link', label: 'Paytm link' }, { value: 'cash', label: 'Cash' }];
  // Chips are 28px by spec; these are the screen's main controls, so they get a 44px tap target (design-system: never under 44).
  const bigChip = 'h-11 min-w-0 flex-1 justify-center text-[13px]';

  return (
    <AppShell tabs={false}>
      <CompactHeader title="Record payment" left={<button type="button" aria-label="Close" onClick={() => navigate(`/khata/${id}`)} className="-ml-1 grid size-11 place-items-center rounded-full text-blue active:bg-chip"><X className="size-6" strokeWidth={1.8} /></button>} />
      <Scroll className="pb-6">
        {c && (
          <div className="flex flex-col gap-3 px-4 pt-3">
            <PaytmCard>
              <div className="flex items-center gap-3">
                <RowAvatar name={c.name} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold text-ink">{c.name}</div>
                  <div className="truncate text-[13px] text-ink-2">{c.note ? c.note : `${inr(balance)} pending`}</div>
                </div>
              </div>

              <label htmlFor="amount" className="mt-4 flex h-16 items-center justify-center gap-1 rounded-xl border border-line bg-card px-4 focus-within:border-sky focus-within:ring-2 focus-within:ring-sky/30">
                <span className="font-display text-[24px] font-bold text-ink-2">₹</span>
                <input id="amount" inputMode="decimal" type="number" min={1} max={balance} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus aria-label="Amount in rupees"
                  className="font-display w-full min-w-0 max-w-[220px] bg-transparent text-center text-[32px] font-extrabold tabular-nums text-ink outline-none" />
              </label>

              <PaytmAlert
                tone={tooMuch ? 'error' : 'info'}
                className="mt-3"
                title={<span className="font-display tabular-nums"><span className="text-ink">{inr(n)}</span> <span className="font-medium text-ink-2">of {inr(balance)} ·</span> <span className={cn(left === 0 ? 'text-paid' : 'text-owed')}>{inr(left)} left</span></span>}
              >
                {tooMuch ? 'More than the balance. The ledger does the maths, so this will not save.' : null}
              </PaytmAlert>

              {quick.length > 0 && (
                <div className="mt-3 flex gap-2">
                  {quick.map((v) => (
                    <PaytmChip key={v} selected={n === v} onClick={() => setAmount(String(v))} className={cn(bigChip, 'font-display tabular-nums')}>{inr(v)}</PaytmChip>
                  ))}
                </div>
              )}
            </PaytmCard>

            <PaytmCard title="Paid how" subtitle="Link payments verify themselves. Cash is noted after your yes.">
              <div id="method" role="group" aria-label="Payment method" className="flex gap-2">
                {methods.map((o) => (
                  <PaytmChip key={o.value} selected={method === o.value} icon={o.value === 'link' ? Link2 : HandCoins} onClick={() => setMethod(o.value)} className={bigChip}>{o.label}</PaytmChip>
                ))}
              </div>
              <p className="mt-3 text-[12px] leading-snug text-ink-2">
                {method === 'link'
                  ? `Sends ${c.name} a payment link for ${inr(n)} on WhatsApp. The balance changes only when the verified payment arrives.${c.consent !== 'granted' ? ' Needs WhatsApp consent first.' : ''}`
                  : 'Cash paid at the counter. Saathi reads it back; it is recorded after you say yes.'}
              </p>
            </PaytmCard>

            <div className="pt-1">
              {pending?.state === 'awaiting_confirm' ? <PendingCard /> : (
                <PaytmButton variant="primary" full icon={method === 'link' ? Link2 : HandCoins} disabled={!valid || loading} onClick={() => void go()}>
                  {method === 'link' ? 'Send payment link' : 'Note cash'}
                </PaytmButton>
              )}
            </div>
            <WhichCustomerDialog />
          </div>
        )}
      </Scroll>
    </AppShell>
  );
}
