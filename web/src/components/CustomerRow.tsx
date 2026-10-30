import type { CustomerRowData } from '@/lib/types';
import { initial } from '@/lib/ui';
import { cn, inr } from '@/lib/utils';
import { PaytmRow, RowAvatar } from '@/components/paytm';
import { StatusChip } from './StatusChip';

/** Solid --p-blue circle with the first letter in Manrope (the shop-avatar style). Kept for the pages that still use it. */
export function NavyInitial({ name, className }: { name: string; className?: string }) {
  return <span className={cn('font-display grid size-10 shrink-0 place-items-center rounded-full bg-blue text-[16px] font-bold text-white', className)} aria-hidden="true">{initial(name)}</span>;
}

/**
 * Customer row (spec section 4 "List row"): 56px PaytmRow inside a PaytmCard(padded=false). Sky-tint avatar with the
 * blue initial (a sky dot when the customer has not joined WhatsApp yet), name + note, amount 15/700 in the owed colour
 * with "40 days" under it, or "Paid up" in green. Whole row links to the customer. `last` is accepted for compatibility:
 * the hairline between rows comes from the .p-row rule now.
 */
export function CustomerRow({ c, quiet = false }: { c: CustomerRowData; last?: boolean; quiet?: boolean }) {
  return (
    <PaytmRow
      to={`/khata/${c.id}`}
      chevron
      avatar={
        <RowAvatar name={c.name}>
          {c.consent === 'pending' && <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-card bg-sky" title="Has not joined WhatsApp updates yet" />}
        </RowAvatar>
      }
      title={
        <>
          {c.name}
          {c.disputes > 0 && <StatusChip kind="flagged" className="ml-1.5 align-middle" />}
          {c.consent === 'opted_out' ? <StatusChip kind="optedOut" className="ml-1.5 align-middle" /> : c.reminders_paused ? <StatusChip kind="paused" className="ml-1.5 align-middle" /> : null}
        </>
      }
      // Quiet rows (settled list): the note if there is one, otherwise just the name. Phone numbers are noise in a list.
      sub={quiet ? (c.note || undefined) : (c.note || (c.phone ?? 'No phone'))}
      right={c.balance > 0 ? <span className="text-owed tabular-nums">{inr(c.balance)}</span> : <span className="text-[13px] text-paid">Paid up</span>}
      rightSub={c.balance > 0 ? `${c.days} days` : undefined}
    />
  );
}
