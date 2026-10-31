import { useEffect, useState } from 'react';
import { CalendarPlus, PlayCircle, RotateCcw, Smartphone, X } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { demoDate } from '@/components/AppShell';
import { Grabber, PaytmAlert, PaytmButton, TopBarIcon } from '@/components/paytm';
import { useKhata } from '@/store/useKhata';

/**
 * Hidden demo tools (DEMO_MODE=true only), opened by a long press on the "More" title. Nothing on screen points to it,
 * so the judges see a clean app while the presenter can still skip time ahead and reset between rehearsals.
 */
export function DemoSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { state, fastForward, runReminders, reset } = useKhata();
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => { if (!open) setConfirmReset(false); }, [open]);
  const act = (fn: () => Promise<void>) => { onOpenChange(false); void fn(); };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showCloseButton={false} className="ks-sheet mx-auto w-full max-w-[390px] gap-0 rounded-t-3xl p-0">
        <Grabber />
        <div className="flex h-12 shrink-0 items-center justify-between px-3">
          <TopBarIcon icon={X} label="Close" onClick={() => onOpenChange(false)} />
          <SheetTitle>Demo tools</SheetTitle>
          <span className="size-10" aria-hidden="true" />
        </div>
        <SheetDescription className="px-4 text-center text-[12px] text-ink-2">
          {state ? `Scheduler date: ${demoDate(state.clock_offset_days)}` : 'For rehearsals and the live demo'}
        </SheetDescription>

        <div className="flex flex-col gap-2 px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-3">
          <PaytmButton variant="primary" full icon={CalendarPlus} onClick={() => act(() => fastForward(3))}>Move time forward 3 days</PaytmButton>
          <PaytmButton variant="outline" full icon={PlayCircle} onClick={() => act(runReminders)}>Send due reminders now</PaytmButton>
          <PaytmButton variant="outline" full icon={Smartphone} onClick={() => window.open('/customer?id=1', '_blank', 'noopener')}>Customer's phone (Lakshmi)</PaytmButton>
          {confirmReset ? (
            <PaytmAlert
              tone="warning"
              title="Reset all demo data?"
              action={<>
                <PaytmButton variant="dark" size="sm" icon={RotateCcw} onClick={() => act(reset)}>Reset</PaytmButton>
                <PaytmButton variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>Keep</PaytmButton>
              </>}
            >
              Customers, entries, reminders and the clock go back to the demo set.
            </PaytmAlert>
          ) : (
            <PaytmButton variant="ghost" full icon={RotateCcw} onClick={() => setConfirmReset(true)}>Reset demo data</PaytmButton>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
