import { Languages, QrCode, Users, type LucideIcon } from 'lucide-react';
import { AppShell, HeaderBand, Scroll } from '@/components/AppShell';
import { LanguageSelect } from '@/components/LanguageSelect';
import { PaytmBadge, PaytmCard, PaytmRow } from '@/components/paytm';
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

/** More: shop, language, features coming soon, and how to install the app on a phone. */
export function AccountPage() {
  const { state } = useKhata();
  const name = state?.merchant.shop_name ?? 'Khata Saathi';

  return (
    <AppShell>
      <HeaderBand title="More" />
      <Scroll className="pb-6">
        <div className="flex flex-col gap-3 px-4 pt-1">
          <PaytmCard title="Shop" padded={false}>
            <PaytmRow avatar={name} title={name} sub={state?.merchant.phone ?? 'Paytm merchant'} />
            <PaytmRow avatar={<IconCircle icon={Languages} />} title={<label htmlFor="lang">I speak, Saathi replies in</label>} right={<LanguageSelect id="lang" />} />
          </PaytmCard>

          <PaytmCard title="Coming soon" padded={false}>
            <PaytmRow avatar={<IconCircle icon={QrCode} muted />} title="Join my khata" sub="QR code customers scan to join" rightSub={<PaytmBadge tone="grey">Soon</PaytmBadge>} disabled />
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
