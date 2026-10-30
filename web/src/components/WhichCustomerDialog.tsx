import { UserPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PaytmButton, PaytmRow } from '@/components/paytm';
import { inr } from '@/lib/utils';
import { useKhata } from '@/store/useKhata';

/**
 * Slide 4 "Two customers named Ramesh? It asks which one." The server returns awaiting_choice with the options.
 * Paytm dialog: white, radius 16, title 18/800 blue, options as PaytmRows, Cancel as a ghost pill.
 */
export function WhichCustomerDialog() {
  const { pending, choose, newCustomer, reject, loading } = useKhata();
  const open = pending?.state === 'awaiting_choice';
  if (!pending) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) void reject(); }}>
      <DialogContent showCloseButton={false} className="max-w-[340px] gap-0 overflow-hidden rounded-2xl p-0">
        <DialogHeader className="px-4 pb-3 pt-5">
          <DialogTitle className="text-center">Which {pending.spoken_name || 'customer'}?</DialogTitle>
          <DialogDescription className="text-center">
            {pending.amount ? `${inr(pending.amount)} · ` : ''}{pending.options.length} match. Saathi never guesses on money.
          </DialogDescription>
        </DialogHeader>
        <div className="border-t border-line">
          {pending.options.map((c) => (
            <PaytmRow key={c.id} avatar={c.name} title={c.name} sub={c.note || c.phone || undefined} disabled={loading} onClick={() => void choose(c.id)}
              right={<span className={c.balance > 0 ? 'text-owed' : 'text-paid'}>{c.balance > 0 ? `owes ${inr(c.balance)}` : 'no dues'}</span>} />
          ))}
          {pending.kind === 'add_credit' && pending.new_customer_name && (
            <PaytmRow
              avatar={<span className="grid size-10 shrink-0 place-items-center rounded-full bg-sky-tint text-sky-ink" aria-hidden="true"><UserPlus className="size-5" strokeWidth={1.8} /></span>}
              title={<span className="text-sky-ink">New customer: {pending.new_customer_name}</span>}
              disabled={loading}
              onClick={() => void newCustomer()}
            />
          )}
        </div>
        <div className="border-t border-line px-4 py-3">
          <PaytmButton variant="ghost" full onClick={() => void reject()}>Cancel</PaytmButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
