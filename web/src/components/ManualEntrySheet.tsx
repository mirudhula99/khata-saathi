import { useEffect, useMemo, useState } from 'react';
import { Check, ShoppingBasket, X } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Grabber, PaytmAlert, PaytmBadge, PaytmButton, PaytmCard, PaytmChip, PaytmRow, RowAvatar, TopBarIcon } from '@/components/paytm';
import type { CustomerRowData } from '@/lib/types';
import { inr } from '@/lib/utils';
import { useKhata } from '@/store/useKhata';

type Kind = 'udhaar' | 'cash' | 'link';
const KINDS: { value: Kind; label: string }[] = [{ value: 'udhaar', label: 'Udhaar' }, { value: 'cash', label: 'Cash received' }, { value: 'link', label: 'Payment link' }];

/**
 * "Add by hand": the typed fallback for the voice flow, as a Paytm bottom sheet (grabber, 18/800 blue title, full-width pill).
 * It composes the sentence the merchant would have said and sends it through /api/command, so it goes through the
 * same understand → read-back → yes path as voice. Nothing is saved from this sheet directly.
 */
export function ManualEntrySheet({ open, onOpenChange, customerId, startNew, startKind }: { open: boolean; onOpenChange: (o: boolean) => void; customerId?: number | null; startNew?: boolean; startKind?: Kind }) {
  const { state, command, addCustomer, loading } = useKhata();
  const customers = useMemo(() => state?.customers ?? [], [state]);
  const [query, setQuery] = useState('');
  const [picking, setPicking] = useState(false);
  const [customer, setCustomer] = useState<CustomerRowData | null>(null);
  const [newName, setNewName] = useState('');
  const [items, setItems] = useState('');
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<Kind>('udhaar');

  useEffect(() => {
    if (!open) return;
    setQuery(''); setItems(''); setAmount(''); setKind(startKind ?? 'udhaar'); setNewName('');
    const c = customerId != null ? customers.find((x) => x.id === customerId) ?? null : null;
    setCustomer(c);
    setPicking(Boolean(startNew) || !c);
  }, [open, customerId, startNew, startKind, customers]);

  const filtered = useMemo(() => customers.filter((c) => !query || c.name.toLowerCase().includes(query.toLowerCase())), [customers, query]);
  const n = Number(amount) || 0;
  const who = customer?.name || newName;
  const valid = Boolean(who) && n > 0 && (kind === 'udhaar' || Boolean(customer));
  // A new name with no amount: just add the customer (they owe nothing yet).
  const addOnly = !customer && Boolean(newName) && kind === 'udhaar' && !amount.trim();

  const pick = (c: CustomerRowData) => { setCustomer(c); setNewName(''); setQuery(''); setPicking(false); };

  const save = async () => {
    if (!valid) return;
    const sentence = kind === 'udhaar' ? `${who} ${n} udhaar${items.trim() ? ' ' + items.trim() : ''}`
      : kind === 'cash' ? `${who} paid ${n} cash`
      : `Ask ${who} for ${n}`;
    onOpenChange(false);
    await command(sentence, customer?.id);
  };

  const saveCustomerOnly = async () => {
    if (await addCustomer(newName) != null) onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showCloseButton={false} className="ks-sheet mx-auto max-h-[88dvh] w-full max-w-[390px] gap-0 rounded-t-3xl p-0">
        <Grabber />
        <div className="flex h-12 shrink-0 items-center justify-between px-3">
          <TopBarIcon icon={X} label="Close" onClick={() => onOpenChange(false)} />
          <SheetTitle>{kind === 'cash' ? 'Record payment' : kind === 'link' ? 'Send payment link' : 'Add udhaar by hand'}</SheetTitle>
          <span className="size-10" aria-hidden="true" />
        </div>
        <SheetDescription className="sr-only">Record an udhaar entry, a cash payment or a payment link without voice. Saathi reads it back before saving.</SheetDescription>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-3 px-4 pb-4 pt-1">
            {/* Customer: a selected chip (tap to change) or the name field with the matching rows under it. */}
            <div className="flex flex-col gap-2">
              <span className="text-[12px] font-medium text-ink-2">Customer</span>
              {who && !picking ? (
                <div className="flex items-center">
                  <PaytmChip selected onClick={() => setPicking(true)} aria-label={`Customer: ${who}. Tap to change`} className="h-9 gap-1.5 pl-1 pr-3 text-[13px] font-semibold" icon={<RowAvatar name={who} className="size-7 text-[13px]" />}>
                    {who}{!customer && <PaytmBadge tone="grey" className="ml-0.5">new</PaytmBadge>}
                  </PaytmChip>
                </div>
              ) : (
                <Input id="who" autoFocus={picking} value={query} onFocus={() => setPicking(true)} onChange={(e) => { setQuery(e.target.value); setPicking(true); }} placeholder="Name" autoComplete="off" />
              )}
              {picking && (filtered.length > 0 || query) && (
                <PaytmCard padded={false}>
                  {filtered.map((c) => (
                    <PaytmRow key={c.id} avatar={c.name} title={c.name} sub={c.note || undefined} onClick={() => pick(c)}
                      right={<span className={c.balance > 0 ? 'text-owed' : 'text-paid'}>{c.balance > 0 ? inr(c.balance) : 'Paid up'}</span>} />
                  ))}
                  {query && !filtered.some((c) => c.name.toLowerCase() === query.toLowerCase()) && (
                    <PaytmRow
                      avatar={<span className="grid size-10 shrink-0 place-items-center rounded-full bg-sky-tint text-sky-ink" aria-hidden="true"><Check className="size-5" strokeWidth={1.8} /></span>}
                      title={<span className="text-sky-ink">Add "{query.trim()}" as a new customer</span>}
                      onClick={() => { setCustomer(null); setNewName(query.trim()); setQuery(''); setPicking(false); setKind('udhaar'); }}
                    />
                  )}
                </PaytmCard>
              )}
            </div>

            {/* Kind: segmented chips. */}
            <div className="flex flex-col gap-1.5">
              <div id="kind" role="group" aria-label="Entry kind" className="flex flex-wrap gap-2">
                {KINDS.map((o) => (
                  <PaytmChip key={o.value} selected={kind === o.value} onClick={() => setKind(o.value)} className="h-9 px-3.5 text-[13px]">{o.label}</PaytmChip>
                ))}
              </div>
              <p className="text-[12px] leading-snug text-ink-2">
                {kind === 'udhaar' && 'Customer takes goods now, pays later. They confirm or flag it on WhatsApp.'}
                {kind === 'cash' && 'Cash paid at the counter. Recorded as a repayment after you say yes.'}
                {kind === 'link' && 'Sends a payment link on WhatsApp. Needs the customer\'s consent.'}
              </p>
            </div>

            {kind === 'udhaar' && (
              <label className="flex h-12 items-center gap-3 rounded-xl border border-line bg-card px-4 focus-within:border-sky focus-within:ring-[3px] focus-within:ring-sky/25">
                <ShoppingBasket className="size-[18px] shrink-0 text-ink-3" strokeWidth={1.8} aria-hidden="true" />
                <input id="items" value={items} onChange={(e) => setItems(e.target.value)} placeholder="Items, e.g. 2 kg rice" aria-label="Items" autoComplete="off" className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3" />
              </label>
            )}
            {/* Amount: Manrope 32/800 with a leading ₹ in ink-2 (spec section 4 "Inputs"). */}
            <label className="flex h-16 items-center gap-2 rounded-xl border border-line bg-card px-4 focus-within:border-sky focus-within:ring-[3px] focus-within:ring-sky/25">
              <span className="font-display text-[24px] font-bold text-ink-2" aria-hidden="true">₹</span>
              <input id="amount" inputMode="decimal" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" aria-label="Amount in rupees"
                className="font-display h-full min-w-0 flex-1 bg-transparent text-[32px] font-extrabold tabular-nums text-ink outline-none placeholder:text-ink-3" />
            </label>

            <PaytmAlert tone="info">{addOnly
              ? `Leave the amount empty to add ${newName} with nothing owed.`
              : 'Saathi reads it back on the home screen. Nothing is saved until you tap Save.'}</PaytmAlert>
          </div>
        </div>

        <div className="shrink-0 px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-2">
          {addOnly
            ? <PaytmButton full disabled={loading} onClick={() => void saveCustomerOnly()}>Add customer</PaytmButton>
            : <PaytmButton full disabled={!valid || loading} onClick={() => void save()}>Next</PaytmButton>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
