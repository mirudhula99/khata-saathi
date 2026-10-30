import { useState } from 'react';
import { Bot, CalendarPlus, ExternalLink, Languages, Mic, MessageCircle, Monitor, PlayCircle, QrCode, RotateCcw, Smartphone, Users, Volume2, Wallet, type LucideIcon } from 'lucide-react';
import { AppShell, HeaderBand, Scroll, demoDate } from '@/components/AppShell';
import { LanguageSelect } from '@/components/LanguageSelect';
import { IconTile, PaytmAlert, PaytmBadge, PaytmButton, PaytmCard, PaytmChip, PaytmRow } from '@/components/paytm';
import { cn } from '@/lib/utils';
import { useKhata } from '@/store/useKhata';

/** 40px sky-tint circle with a blue line icon: the row avatar for non-customer rows (spec section 4 List row). */
function IconCircle({ icon: Icon, muted, className }: { icon: LucideIcon; muted?: boolean; className?: string }) {
  return (
    <span className={cn('grid size-10 shrink-0 place-items-center rounded-full', muted ? 'bg-chip text-ink-3' : 'bg-sky-tint text-blue', className)} aria-hidden="true">
      <Icon className="size-5" strokeWidth={1.8} />
    </span>
  );
}

/** More: shop, language, what is switched on (Sarvam / LLM / messaging / payments), demo tools, links to his pages. */
export function AccountPage() {
  const { state, reset, fastForward, runReminders } = useKhata();
  const [confirmReset, setConfirmReset] = useState(false);
  const name = state?.merchant.shop_name ?? 'Khata Saathi';
  const h = state?.health;

  /**
   * Status tile: success tone + sky dot when the real service is on, muted when the browser / rules fallback is in use.
   * It shows state and is not a control, so the tile is `disabled` (out of the tab order) with the dimming overridden.
   * Keep both label lines short: the 11px label clamps at two lines, and the second line is the status itself.
   */
  const status = (icon: LucideIcon, what: string, on: boolean, yes: string, no: string) => (
    <IconTile icon={icon} tone={on ? 'success' : 'muted'} disabled className="disabled:opacity-100" label={<>{what}<br />{on ? yes : no}</>}>
      {on && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-sky" aria-hidden="true" />}
    </IconTile>
  );

  const messaging = h?.messaging === 'simulator' ? 'Simulator' : h?.messaging ?? '';
  const payments = h?.payments === 'paytm' ? 'Paytm' : h?.payments === 'mock' ? 'Mock (sandbox page)' : h?.payments ?? '';

  return (
    <AppShell>
      <HeaderBand title="More" />
      <Scroll className="pb-6">
        <div className="flex flex-col gap-3 px-4 pt-1">
          <PaytmCard title="Shop" padded={false}>
            <PaytmRow avatar={name} title={name} sub={state?.merchant.phone ?? 'Paytm merchant'} />
            <PaytmRow avatar={<IconCircle icon={Languages} />} title={<label htmlFor="lang">I speak, Saathi replies in</label>} right={<LanguageSelect id="lang" />} />
          </PaytmCard>

          <PaytmCard title="System" subtitle="What is switched on">
            <div className="grid grid-cols-4 gap-3">
              {status(Mic, 'Hearing', Boolean(h?.voice), 'Sarvam', 'Browser')}
              {status(Bot, 'Thinking', Boolean(h?.llm), 'LLM + checks', 'Rules only')}
              {status(Volume2, 'Speaking', Boolean(h?.tts), 'Sarvam', 'Browser')}
              {status(MessageCircle, 'Messages', h?.messaging === 'whatsapp', 'WhatsApp', messaging)}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <PaytmChip icon={Wallet} selected={h?.payments === 'paytm'}>Payments · {payments}</PaytmChip>
            </div>
            {h && !h.ffmpeg && (
              <PaytmAlert tone="error" className="mt-3">
                ffmpeg is not on the server's PATH, so recordings cannot be read. Open a new terminal after installing it and restart.
              </PaytmAlert>
            )}
            <p className="mt-3 text-[12px] leading-snug text-ink-2">AI understands, code calculates. The LLM only returns the intent; app/ledger.py does every rupee.</p>
          </PaytmCard>

          {h?.demo_mode && (
            <PaytmCard title="Demo clock" subtitle={state ? `The scheduler thinks today is ${demoDate(state.clock_offset_days)}` : 'For the stage: skip ahead so reminders fall due'}>
              <p className="mb-3 text-[13px] leading-snug text-ink-2">Reminders go out on real time: a few days after an entry, then every couple of days, 9am to 8pm. On stage, skip ahead instead of waiting.</p>
              <div className="flex flex-wrap gap-2">
                <PaytmButton variant="primary" icon={CalendarPlus} onClick={() => void fastForward(3)}>Move time forward 3 days</PaytmButton>
                <PaytmButton variant="outline" icon={PlayCircle} onClick={() => void runReminders()}>Send due reminders now</PaytmButton>
              </div>
            </PaytmCard>
          )}

          <PaytmCard title="Demo" subtitle="Pages for the demo and the original UI" padded={false}>
            <PaytmRow avatar={<IconCircle icon={Smartphone} />} title="Customer's phone" sub="WhatsApp simulator" href="/customer" target="_blank" right={<ExternalLink className="size-4 text-ink-3" strokeWidth={2} aria-hidden="true" />} />
            <PaytmRow avatar={<IconCircle icon={QrCode} />} title="Join my khata" sub="QR page customers scan" href={`/join/${state?.merchant.id ?? 1}`} target="_blank" right={<ExternalLink className="size-4 text-ink-3" strokeWidth={2} aria-hidden="true" />} />
            <PaytmRow avatar={<IconCircle icon={Monitor} />} title="Original one-screen UI" sub="Legacy page" href="/legacy" chevron />
            {h?.demo_mode && (
              <div className="px-4 pb-4 pt-2">
                {confirmReset ? (
                  <PaytmAlert
                    tone="warning"
                    title="Reset all demo data?"
                    action={
                      <>
                        <PaytmButton variant="dark" size="sm" icon={RotateCcw} onClick={() => { setConfirmReset(false); void reset(); }}>Reset</PaytmButton>
                        <PaytmButton variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>Keep</PaytmButton>
                      </>
                    }
                  >
                    Customers, entries and reminders go back to the demo set.
                  </PaytmAlert>
                ) : (
                  <PaytmButton variant="outline" full icon={RotateCcw} onClick={() => setConfirmReset(true)}>Reset demo data</PaytmButton>
                )}
              </div>
            )}
          </PaytmCard>

          <PaytmCard title="Coming soon" padded={false}>
            <PaytmRow avatar={<IconCircle icon={Users} muted />} title="Family khata" sub="One account for a household" rightSub={<PaytmBadge tone="grey">Soon</PaytmBadge>} disabled />
          </PaytmCard>

          <PaytmCard title="Install on a phone">
            <p className="text-[13px] leading-snug text-ink-2">Open the https tunnel link in Safari (iPhone) or Chrome (Android), then Share, then "Add to Home Screen". The mic only works on https.</p>
          </PaytmCard>

          <p className="pt-1 text-center text-[11px] text-ink-2">Khata Saathi · Team Rupeeriot · Paytm Build for India AI Hackathon, Bengaluru</p>
        </div>
      </Scroll>
    </AppShell>
  );
}
