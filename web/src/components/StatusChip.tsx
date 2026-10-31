import { PaytmBadge } from '@/components/paytm';
import { useT } from '@/lib/i18n';

type Kind = 'awaiting' | 'flagged' | 'remindedToday' | 'paused' | 'optedOut' | 'noConsent' | 'settled' | 'verified' | 'cashNoted' | 'removed';
type Tone = 'sky' | 'success' | 'warning' | 'error' | 'grey';

/** Spec section 4 "Status badges": awaiting = sky, flagged = error pastel, paused = warning pastel, settled/verified = success pastel, cash noted = grey chip. */
const STYLE: Record<Kind, { label: string; tone: Tone }> = {
  awaiting: { label: 'Awaiting confirm', tone: 'sky' },
  flagged: { label: 'Says wrong', tone: 'error' },
  remindedToday: { label: 'Reminded', tone: 'grey' },
  paused: { label: 'Paused', tone: 'warning' },
  optedOut: { label: 'Stopped reminders', tone: 'grey' },
  noConsent: { label: 'No WhatsApp yet', tone: 'grey' },
  settled: { label: 'Paid up', tone: 'success' },
  verified: { label: 'Verified ✓', tone: 'success' },
  cashNoted: { label: 'Cash', tone: 'grey' },
  removed: { label: 'Removed', tone: 'grey' },
};

/** Tiny status pill, 11/600 (not uppercase any more). Same `kind` API as before. The label follows the merchant's language. */
export function StatusChip({ kind, className }: { kind: Kind; className?: string }) {
  const t = useT();
  const s = STYLE[kind];
  return <PaytmBadge tone={s.tone} className={className}>{t(s.label)}</PaytmBadge>;
}
