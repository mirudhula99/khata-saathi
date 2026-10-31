import { useEffect, useState } from 'react';
import { Check, PenLine, X } from 'lucide-react';
import { PaytmButton } from '@/components/paytm';
import { SaathiCard } from '@/components/SaathiCard';
import { useT } from '@/lib/i18n';
import { KIND_LABEL } from '@/lib/ui';
import { cn, inr } from '@/lib/utils';
import { useKhata } from '@/store/useKhata';

/**
 * The read-back card: what Saathi understood, waiting for the merchant's yes. A PaytmAlert(info) with pill buttons.
 * Save / Change amount / Cancel map to /api/actions/{id}/confirm | correct | reject. Voice "No, 150" also corrects.
 */
export function PendingCard() {
  const t = useT();
  const { pending, lastReply, lastWarning, loading, confirm, correct, reject } = useKhata();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState('');
  useEffect(() => { setEditing(false); setAmount(pending?.amount != null ? String(pending.amount) : ''); }, [pending?.id, pending?.amount]);
  if (!pending || pending.state !== 'awaiting_confirm') return null;

  const who = pending.customer?.name ?? pending.new_customer_name ?? '';
  const isNew = !pending.customer && Boolean(pending.new_customer_name);
  const detail = [t(KIND_LABEL[pending.kind] ?? 'Entry'), who ? (isNew ? t('{name} (new customer)', { name: who }) : who) : null, pending.amount != null ? inr(pending.amount) : null, pending.items.length ? pending.items.join(', ') : null, pending.payment_mode === 'cash' ? t('in cash') : null].filter(Boolean).join(' · ');
  const saveLabel = pending.kind === 'request_payment' ? t('Send link') : t('Save');

  return (
    <SaathiCard
      text={lastReply || detail}
      // The read-back already says who and how much; only a warning about the amount is worth a second line.
      hint={lastWarning === 'amount_from_transcript' ? <span className="text-error-ink">{t('Check the amount: Saathi used the number it heard.')}</span>
        : lastWarning === 'amount_out_of_range' ? <span className="text-error-ink">{t('That amount is not allowed. Try again.')}</span>
        : undefined}
      actions={editing ? (
        <form className="flex w-full items-center gap-2" onSubmit={(e) => { e.preventDefault(); const v = parseInt(amount, 10); if (v > 0) void correct(v).then(() => setEditing(false)); }}>
          <label className="flex h-11 min-w-0 flex-1 items-center gap-1 rounded-full bg-card px-4 shadow-card">
            <span className="font-display text-[18px] font-bold text-ink-2">₹</span>
            <input id="correctAmount" autoFocus inputMode="numeric" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} aria-label={t('Amount in rupees')}
              className="font-display h-full w-full min-w-0 bg-transparent text-[18px] font-bold text-ink outline-none" />
          </label>
          <PaytmButton type="submit" variant="dark" disabled={loading}>{t('Update')}</PaytmButton>
          <PaytmButton variant="ghost" onClick={() => setEditing(false)} className="px-3">{t('Back')}</PaytmButton>
        </form>
      ) : (
        <>
          <PaytmButton variant="primary" icon={Check} disabled={loading} onClick={() => void confirm()} className={cn(!loading && 'ks-attention')}>{saveLabel}</PaytmButton>
          {pending.kind !== 'request_payment' && <PaytmButton variant="outline" icon={PenLine} disabled={loading} onClick={() => setEditing(true)}>{t('Change amount')}</PaytmButton>}
          <PaytmButton variant="ghost" icon={X} disabled={loading} onClick={() => void reject()} className="px-3">{t('Cancel')}</PaytmButton>
        </>
      )}
    />
  );
}
