import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Grabber, PaytmAlert, PaytmButton, TopBarIcon } from '@/components/paytm';
import type { CustomerPatch, CustomerRowData } from '@/lib/types';
import { inr } from '@/lib/utils';
import { useKhata } from '@/store/useKhata';

/**
 * Edit one customer from More → Customers: name, mobile, unique label (a street, profession or anything that tells customers apart, kept in `note`) and the
 * amount they owe. Only changed fields are sent. A new amount owed is booked by the server as a "balance corrected"
 * entry, so the history is never rewritten.
 */
export function CustomerEditSheet({ customer, onOpenChange }: { customer: CustomerRowData | null; onOpenChange: (o: boolean) => void }) {
  const { patchCustomer, removeCustomer, loading } = useKhata();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [balance, setBalance] = useState('');
  const [limit, setLimit] = useState('');
  const [error, setError] = useState('');

  // Fill the form when a customer is opened. Keyed on the id, not the object: live updates (a payment arriving)
  // refresh the customer list and must not wipe what the merchant is typing.
  useEffect(() => {
    if (!customer) return;
    setName(customer.name); setPhone(customer.phone ?? ''); setNote(customer.note ?? '');
    setConfirmRemove(false);
    setBalance(String(customer.balance)); setLimit(customer.credit_limit ? String(customer.credit_limit) : ''); setError('');
  }, [customer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const owed = Number(balance);
  const flagged = (customer?.disputes ?? 0) > 0;
  const balanceChanged = customer != null && balance.trim() !== '' && owed !== customer.balance;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    if (!name.trim()) { setError('Enter the customer’s name.'); return; }
    if (phone.trim() && phone.replace(/\D/g, '').length < 10) { setError('Enter a 10-digit mobile number, or leave it empty.'); return; }
    if (balance.trim() === '' || !Number.isInteger(owed) || owed < 0) { setError('Enter what they owe in whole rupees (0 if nothing).'); return; }
    const limitValue = limit.trim() === '' ? null : Number(limit);
    if (limitValue !== null && (!Number.isInteger(limitValue) || limitValue < 1)) { setError('Enter the credit limit in whole rupees, or leave it empty for no limit.'); return; }
    const patch: CustomerPatch = {};
    if (name.trim() !== customer.name) patch.name = name.trim();
    if (phone.trim() !== (customer.phone ?? '')) patch.phone = phone.trim();
    if (note.trim() !== (customer.note ?? '')) patch.note = note.trim();
    if (balanceChanged) patch.balance = owed;
    if (limitValue !== (customer.credit_limit ?? null)) patch.credit_limit = limitValue;
    if (Object.keys(patch).length === 0) { onOpenChange(false); return; }
    if (await patchCustomer(customer.id, patch)) onOpenChange(false);
  };

  return (
    <Sheet open={customer != null} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showCloseButton={false} className="ks-sheet mx-auto max-h-[88dvh] w-full max-w-[390px] gap-0 rounded-t-3xl p-0">
        <Grabber />
        <div className="flex h-12 shrink-0 items-center justify-between px-3">
          <TopBarIcon icon={X} label="Close" onClick={() => onOpenChange(false)} />
          <SheetTitle>Edit customer</SheetTitle>
          <span className="size-10" aria-hidden="true" />
        </div>
        <SheetDescription className="sr-only">Change the customer's name, mobile number, unique label, and how much they owe.</SheetDescription>

        <form onSubmit={(e) => void save(e)} className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pb-4 pt-1">
            <label className="text-[12px] font-medium text-ink-2" htmlFor="custName">Name</label>
            <Input id="custName" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="off" />

            <label className="mt-1 text-[12px] font-medium text-ink-2" htmlFor="custPhone">Mobile number</label>
            <Input id="custPhone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" maxLength={20} autoComplete="off" placeholder="Optional" />

            <label className="mt-1 text-[12px] font-medium text-ink-2" htmlFor="custNote">Unique label</label>
            <Input id="custNote" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} autoComplete="off" placeholder="e.g. Gandhi Street, Teacher, Bus stand" />
            <p className="text-[12px] leading-snug text-ink-2">Tells two customers with the same name apart, like Ramesh (Teacher) and Ramesh (Gandhi Street).</p>

            <label className="mt-1 text-[12px] font-medium text-ink-2" htmlFor="custBalance">Amount owed</label>
            <label className="flex h-14 items-center gap-2 rounded-xl border border-line bg-card px-4 focus-within:border-sky focus-within:ring-[3px] focus-within:ring-sky/25">
              <span className="font-display text-[20px] font-bold text-ink-2" aria-hidden="true">₹</span>
              <input id="custBalance" inputMode="numeric" type="number" min={0} step={1} value={balance} onChange={(e) => setBalance(e.target.value)} disabled={flagged}
                className="font-display h-full min-w-0 flex-1 bg-transparent text-[24px] font-extrabold tabular-nums text-ink outline-none" />
            </label>
            {flagged && <p className="text-[12px] leading-snug text-owed">They flagged an entry. Keep or remove it on their page before changing what they owe.</p>}
            {balanceChanged && customer && Number.isInteger(owed) && owed >= 0 && (
              <PaytmAlert tone="info">
                {inr(customer.balance)} → {inr(owed)}. A “balance corrected” entry of {owed > customer.balance ? '+' : '−'}{inr(Math.abs(owed - customer.balance))} is added; past entries stay as they are.{owed > customer.balance && customer.consent === 'granted' ? ' They get a WhatsApp to confirm it or say it’s wrong.' : ''}
              </PaytmAlert>
            )}
            <label className="mt-1 text-[12px] font-medium text-ink-2" htmlFor="custLimit">Credit limit</label>
            <label className="flex h-12 items-center gap-2 rounded-xl border border-line bg-card px-4 focus-within:border-sky focus-within:ring-[3px] focus-within:ring-sky/25">
              <span className="font-display text-[18px] font-bold text-ink-2" aria-hidden="true">₹</span>
              <input id="custLimit" inputMode="numeric" type="number" min={1} step={1} value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="No limit"
                className="h-full min-w-0 flex-1 bg-transparent text-[16px] font-semibold tabular-nums text-ink outline-none placeholder:font-normal placeholder:text-ink-3" />
            </label>
            <p className="text-[12px] leading-snug text-ink-2">If new udhaar takes them over this, Saathi warns you before saving.</p>
            {error && <p className="text-[12px] text-error-ink">{error}</p>}

            {/* Only customers with nothing in the khata can go (a mistaken add, or a spam join); the server checks. */}
            {customer && customer.balance === 0 && (confirmRemove ? (
              <PaytmAlert tone="warning" title={`Remove ${customer.name}?`} className="mt-2"
                action={<>
                  <PaytmButton variant="dark" size="sm" onClick={() => void removeCustomer(customer.id).then((ok) => ok && onOpenChange(false))}>Remove</PaytmButton>
                  <PaytmButton variant="ghost" size="sm" onClick={() => setConfirmRemove(false)}>Keep</PaytmButton>
                </>}>
                Only possible if they have no entries in the khata.
              </PaytmAlert>
            ) : (
              <button type="button" onClick={() => setConfirmRemove(true)} className="mt-2 self-start text-[13px] font-semibold text-error-ink active:opacity-70">Remove customer</button>
            ))}
          </div>

          <div className="grid shrink-0 grid-cols-2 gap-2 px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-2">
            <PaytmButton variant="ghost" full onClick={() => onOpenChange(false)}>Cancel</PaytmButton>
            <PaytmButton type="submit" variant="primary" full disabled={loading}>Save</PaytmButton>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
