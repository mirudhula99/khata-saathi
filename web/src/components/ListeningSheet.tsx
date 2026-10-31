import { Mic, Square, X } from 'lucide-react';
import { PaytmButton } from '@/components/paytm';
import { useT } from '@/lib/i18n';
import { LANGS } from '@/lib/speech';
import { SUGGESTIONS, listeningLabel } from '@/lib/ui';
import type { LangCode } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Full-screen listening sheet. Opens when the mic starts, closes when it stops.
 * Shows "Listening…" in the merchant's language, a pulsing mic (tap = stop and send), a waveform, what is being heard
 * (browser speech only), and "Try saying" example bubbles in the chosen language. Tapping a bubble cancels the mic and
 * sends that sentence instead, so the stage demo has a safe fallback if the room is noisy.
 */
export function ListeningSheet({ open, lang, heard, onStop, onCancel, onPick }: {
  open: boolean; lang: LangCode; heard?: string; onStop: () => void; onCancel: () => void; onPick: (text: string) => void;
}) {
  const t = useT();
  if (!open) return null;
  const label = listeningLabel(lang);
  const language = LANGS.find((l) => l.code === lang);
  const examples = SUGGESTIONS[lang].slice(0, 4);
  return (
    <div role="dialog" aria-modal="true" aria-label={t('Listening')} className="ks-fade-up absolute inset-0 z-40 flex flex-col bg-card">
      <div className="flex h-14 shrink-0 items-center justify-between px-3">
        <button type="button" onClick={onCancel} aria-label={t('Cancel')} className="grid size-11 place-items-center rounded-full text-ink-2 active:bg-chip"><X className="size-6" /></button>
        {language && <span className="rounded-full bg-chip px-3 py-1 text-[12px] font-medium text-ink-2">{language.native} · {language.label}</span>}
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 pt-2">
        <div className="font-display text-center text-[24px] font-extrabold leading-tight text-blue">{label.native}</div>
        <div className="mt-1 text-[13px] text-ink-2">{label.en}</div>

        <div className="relative mt-6 grid place-items-center">
          <span aria-hidden="true" className="ks-ring absolute size-36 rounded-full bg-sky/40" />
          <button type="button" onClick={onStop} aria-label={t('Stop and send')}
            style={{ boxShadow: '0 16px 40px rgba(0, 186, 242, 0.55), 0 0 0 10px rgba(0, 186, 242, 0.12)' }}
            className="relative grid size-36 place-items-center rounded-full bg-sky text-white transition-transform active:scale-95">
            <Mic className="size-16" strokeWidth={2} />
          </button>
        </div>
        <div className="ks-wave mt-5 flex items-center gap-1" aria-hidden="true"><span /><span /><span /><span /><span /></div>
        <div className={cn('mt-3 min-h-6 text-center text-[15px] text-ink', !heard && 'text-ink-3')}>{heard || t('Say the name, the amount and the items')}</div>

        <div className="mt-6 w-full">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-2">{t('Try saying')}</div>
          <div className="flex flex-col gap-2">
            {examples.map((s, i) => (
              <button key={s.send + s.native} type="button" onClick={() => onPick(s.send)}
                className={cn('max-w-[88%] rounded-2xl px-4 py-2.5 text-left shadow-card active:scale-[0.99]',
                  i % 2 === 0 ? 'self-start rounded-bl-md bg-sky-tint' : 'self-end rounded-br-md bg-chip')}>
                <span className="block text-[15px] font-semibold text-ink">{s.native}</span>
                {s.native !== s.send && <span className="block text-[12px] text-ink-2">{s.send}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="shrink-0 px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-3">
        <PaytmButton variant="dark" full icon={Square} onClick={onStop}>{t('Stop and send')}</PaytmButton>
      </div>
    </div>
  );
}
