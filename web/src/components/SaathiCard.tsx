import type { ReactNode } from 'react';
import { PaytmAlert } from '@/components/paytm';
import { useSpeaking } from '@/lib/speech';
import { cn } from '@/lib/utils';

/**
 * The Saathi reply card: one shape for read-backs, answers and errors, now a PaytmAlert strip (info, or error).
 * "SAATHI" label, the reply in Manrope 16/700, an optional hint line and a row of pill actions.
 * While speech synthesis is talking, a thin sky bar runs along the top edge (.ks-speaking).
 */
export function SaathiCard({ text, actions, hint, tone = 'default', className }: { text: ReactNode; actions?: ReactNode; hint?: ReactNode; tone?: 'default' | 'error'; className?: string }) {
  const speaking = useSpeaking();
  return (
    <PaytmAlert
      tone={tone === 'error' ? 'error' : 'info'}
      className={cn('ks-fade-up', speaking && 'ks-speaking', className)}
      title={<span className="label-caps">Saathi</span>}
      action={actions}
    >
      <div className="font-display text-[16px] font-bold leading-snug text-ink">{text}</div>
      {hint != null && <div className="mt-1 text-[12px] leading-snug text-ink-2">{hint}</div>}
    </PaytmAlert>
  );
}
