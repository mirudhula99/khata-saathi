import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IndianRupee, PenLine, QrCode, Smartphone } from 'lucide-react';
import { AppShell, HeaderBand, Scroll } from '@/components/AppShell';
import { DashboardCards } from '@/components/DashboardCards';
import { ManualEntrySheet } from '@/components/ManualEntrySheet';
import { MicHero } from '@/components/MicHero';
import { IconTile, PaytmButton, PaytmCard } from '@/components/paytm';
import { PendingCard } from '@/components/PendingCard';
import { SaathiCard } from '@/components/SaathiCard';
import { WhichCustomerDialog } from '@/components/WhichCustomerDialog';
import { greeting } from '@/lib/ui';
import { useKhata } from '@/store/useKhata';

/**
 * Home = Saathi, Paytm edition (spec section 5). Design intent §1: voice is the product, so the mic and the reply are the hero.
 * Top bar + greeting line → card "Speak to Saathi" → read-back / reply strip → card "Try saying" → pending summary banner
 * → card "Quick actions" (Add by hand, Customer's phone, Reminders, Khata). Speak → read-back → Save. Ask → answer.
 */
export function SaathiPage({ focusMic = false }: { focusMic?: boolean }) {
  const [params, setParams] = useSearchParams();
  const { state, lang, pending, lastReply, lastTranscript, lastWarning, dismiss } = useKhata();
  const [manual, setManual] = useState(false);
  const [manualKind, setManualKind] = useState<'udhaar' | 'cash'>('udhaar');

  // /add?customer=3 or /add?new=1 open the by-hand sheet (links from the customer screen and "Add customer").
  const manualFor = params.get('customer');
  const manualNew = params.get('new') === '1';
  useEffect(() => { if (manualFor || manualNew) setManual(true); }, [manualFor, manualNew]);
  const closeManual = (o: boolean) => { setManual(o); if (!o && (manualFor || manualNew)) setParams({}, { replace: true }); };

  const awaiting = pending?.state === 'awaiting_confirm';
  const shop = state?.merchant.shop_name ?? 'Khata Saathi';

  return (
    <AppShell>
      <HeaderBand />
      <Scroll className="pb-6">
        <div className="flex flex-col gap-3 px-4 pt-1">
          {/* Greeting panel: just the greeting and the shop's name. No date: the phone's status bar has the time, and the demo strip shows a shifted day. */}
          <PaytmCard>
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-ink-2">{greeting(lang)},</div>
                <h1 className="font-display truncate text-[24px] font-extrabold leading-tight text-blue">{shop}</h1>
              </div>
            </div>
          </PaytmCard>

          {/* The mic card. While listening, MicHero opens the full-screen listening sheet with example bubbles. */}
          <MicHero
            autoFocus={focusMic}
            after={
              <>
                {awaiting && <PendingCard />}
                {!awaiting && lastReply && (
                  <SaathiCard
                    text={lastReply}
                    tone={lastWarning === 'error' ? 'error' : 'default'}
                    hint={lastTranscript ? `You said: "${lastTranscript}"` : undefined}
                    actions={<PaytmButton variant="ghost" size="sm" onClick={dismiss} className="px-3">Done</PaytmButton>}
                  />
                )}
              </>
            }
          />

          {/* Quick actions: only things not already in the tab bar. */}
          <PaytmCard title="Quick actions">
            <div className="grid grid-cols-4 gap-3">
              <IconTile icon={PenLine} label="Add by hand" onClick={() => { setManualKind('udhaar'); setManual(true); }} />
              <IconTile icon={IndianRupee} label={<>Record<br />payment</>} onClick={() => { setManualKind('cash'); setManual(true); }} />
              <IconTile icon={Smartphone} label={<>Customer's<br />phone</>} href="/customer" target="_blank" />
              <IconTile icon={QrCode} label={<>Join my<br />khata</>} href={`/join/${state?.merchant.id ?? 1}`} target="_blank" />
            </div>
          </PaytmCard>

          {/* Two live charts from his ledger (GET /api/stats): who owes you, and this week's given vs received. */}
          <DashboardCards />
        </div>
        <WhichCustomerDialog />
        <ManualEntrySheet open={manual} onOpenChange={closeManual} customerId={manualFor ? Number(manualFor) : null} startNew={manualNew} startKind={manualKind} />
      </Scroll>
    </AppShell>
  );
}
