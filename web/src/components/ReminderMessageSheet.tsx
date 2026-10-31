import { useEffect, useState } from 'react';
import { Lock, MessageCircle, X } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Grabber, PaytmButton, TopBarIcon } from '@/components/paytm';
import { api } from '@/lib/api';
import type { CustomerRowData } from '@/lib/types';
import { useKhata } from '@/store/useKhata';

const MAX = 200;

/**
 * Edit this customer's reminder. The default sentence (with the pay link) and the "Reply STOP" line are locked;
 * the merchant adds one line of their own between them, saved on the customer (PATCH reminder_note), and used by
 * Remind now and every scheduled reminder until cleared. The bubble shows exactly what will go out.
 */
export function ReminderMessageSheet({ customer, open, onOpenChange }: { customer: CustomerRowData | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const patchCustomer = useKhata((s) => s.patchCustomer);
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !customer) return;
    setNote(customer.reminder_note ?? '');
    setPreview('');
    api.reminderPreview(customer.id).then((p) => setPreview(p.text)).catch(() => setPreview(''));
  }, [open, customer]);

  if (!customer) return null;
  // Live preview: the server text with the saved note swapped for what is being typed.
  const lines = preview.split('\n');
  const footer = lines.length > 1 ? lines[lines.length - 1] : 'Reply STOP to stop reminders.';
  const head = lines.length > 1 ? lines.slice(0, lines.length - 1).filter((l) => l !== (customer.reminder_note ?? '').trim()).join('\n') : preview;
  const typed = note.trim();
  const changed = typed !== (customer.reminder_note ?? '').trim();

  const save = async (value: string) => {
    setSaving(true);
    try { await patchCustomer(customer.id, { reminder_note: value || null }); onOpenChange(false); }
    finally { setSaving(false); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showCloseButton={false} className="ks-sheet mx-auto max-h-[88dvh] w-full max-w-[390px] gap-0 rounded-t-3xl p-0">
        <Grabber />
        <div className="flex h-12 shrink-0 items-center justify-between px-3">
          <TopBarIcon icon={X} label="Close" onClick={() => onOpenChange(false)} />
          <SheetTitle>Reminder to {customer.name}</SheetTitle>
          <span className="size-10" aria-hidden="true" />
        </div>
        <SheetDescription className="sr-only">Add your own line to this customer's reminders. The payment link and the STOP line are always included.</SheetDescription>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),16px)]">
          {/* What they get: a WhatsApp-style bubble, locked parts in grey, the merchant's line in ink. */}
          <div className="rounded-2xl bg-wa-bg p-3">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-2"><MessageCircle className="size-3.5" strokeWidth={2} /> What {customer.name.split(' ')[0]} gets</div>
            <div className="max-w-[92%] rounded-xl rounded-bl-md bg-card px-3 py-2 text-[14px] leading-snug shadow-card">
              <span className="whitespace-pre-wrap text-ink-2">{head || 'Loading…'}</span>
              {typed && <span className="block whitespace-pre-wrap font-medium text-ink">{typed}</span>}
              <span className="block text-ink-2">{footer}</span>
            </div>
          </div>

          <label htmlFor="reminderNote" className="block">
            <span className="mb-1 flex items-center justify-between text-[13px] font-medium text-ink-2">
              <span>Your line (optional)</span>
              <span className={note.length > MAX - 20 ? 'text-owed' : 'text-ink-3'}>{note.length}/{MAX}</span>
            </span>
            <textarea id="reminderNote" value={note} onChange={(e) => setNote(e.target.value.slice(0, MAX))} rows={3}
              placeholder="e.g. Also, your Diwali order is ready. Pay when you come by."
              className="w-full resize-none rounded-xl border border-line bg-card px-3 py-2 text-[15px] text-ink outline-none placeholder:text-ink-3 focus:border-sky focus:ring-2 focus:ring-sky/30" />
          </label>
          <p className="flex items-start gap-1.5 text-[12px] leading-snug text-ink-2"><Lock className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} /> The greeting, the amount, the payment link and the STOP line are always sent, in {customer.name.split(' ')[0]}'s language. Your line goes with them in every reminder until you clear it.</p>

          <div className="flex min-w-0 gap-2 pt-1">
            {(customer.reminder_note ?? '') !== '' && <PaytmButton variant="outline" className="shrink-0" onClick={() => void save('')} disabled={saving}>Clear line</PaytmButton>}
            <PaytmButton variant="primary" className="min-w-0 flex-1" onClick={() => void save(typed)} disabled={saving || !changed}>{saving ? 'Saving…' : 'Save'}</PaytmButton>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
