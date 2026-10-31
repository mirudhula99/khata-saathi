import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Languages, Mic, MicOff, Send, Square } from 'lucide-react';
import { LanguageSelect } from '@/components/LanguageSelect';
import { ListeningSheet } from '@/components/ListeningSheet';
import { PaytmCard } from '@/components/paytm';
import { useRecorder } from '@/hooks/useRecorder';
import { useSpeech } from '@/hooks/useSpeech';
import { useT } from '@/lib/i18n';
import { unlockAudio } from '@/lib/speech';
import { cn } from '@/lib/utils';
import { useKhata } from '@/store/useKhata';

/**
 * Mic hero, Paytm edition (spec section 4 "Mic hero" and section 5 "Saathi"): the product is voice, so this is the first
 * card on the home screen. Card "Speak to Saathi" (language chip-select top-right, 128px sky mic, status, type-it pill),
 * then a card "Try saying" of PaytmRows with "More" as the affordance. `after` renders between the two cards
 * (the read-back / reply card on the home screen).
 * Hear path: Sarvam speech-to-text through /api/voice when the server has a key and ffmpeg; otherwise the browser's
 * Web Speech API → /api/command. Both end in the same read-back card. Typed input and rows are the safety net.
 */
export function MicHero({ autoFocus = false, correctionHint = false, after }: { autoFocus?: boolean; correctionHint?: boolean; after?: ReactNode }) {
  const t = useT();
  const { lang, command, voice, loading, state, pending } = useKhata();
  const health = state?.health;
  const serverVoice = Boolean(health?.voice && health?.ffmpeg);
  const [typed, setTyped] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const micRef = useRef<HTMLButtonElement>(null);

  // Spoken (browser speech) and the listening sheet's example bubbles count as voice: Saathi answers aloud.
  // The text box below is typing, so it stays quiet.
  const onFinal = useCallback((text: string) => { void command(text, undefined, true); }, [command]);
  const onClip = useCallback((blob: Blob, filename: string) => { void voice(blob, filename); }, [voice]);
  const ws = useSpeech(lang, onFinal);
  const rec = useRecorder(onClip);

  useEffect(() => { if (autoFocus) micRef.current?.focus(); }, [autoFocus]);
  useEffect(() => { if (correctionHint) inputRef.current?.focus(); }, [correctionHint]);

  const listening = serverVoice ? rec.recording : ws.listening;
  const supported = serverVoice ? typeof MediaRecorder !== 'undefined' : ws.supported;
  const tap = () => { unlockAudio(); if (serverVoice) void rec.toggle(); else ws.start(); };
  // Listening sheet: ✕ cancels without sending; tapping an example bubble cancels the mic and sends that sentence instead.
  const cancel = () => { if (serverVoice) rec.cancel(); else ws.cancel(); };
  const pick = (text: string) => { cancel(); void command(text, undefined, true); };
  const submit = (e: FormEvent) => { e.preventDefault(); const v = typed.trim(); if (!v) return; setTyped(''); void command(v); };

  const status = loading ? t('Understanding…')
    : serverVoice
      ? (rec.error || (rec.recording ? t('Listening… tap to stop') : t('Tap, speak, tap again')))
      : (ws.interim || (ws.listening ? t('Listening…') : ws.supported ? t('Tap and speak an entry, or ask') : t('Mic needs Chrome or Edge. Type below.')));

  return (
    <>
      <PaytmCard title={t('Speak to Saathi')} subtitle={t('Udhaar, payments, or a question')}>
        <div className="flex flex-col items-center gap-3 pt-1">
          {/* Speaking language: its own full-width row so the title is not squeezed. Label left, dropdown right. */}
          <label htmlFor="lang" className="flex h-11 w-full items-center justify-between gap-3 rounded-xl bg-chip px-3">
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink-2"><Languages className="size-4 text-blue-600" strokeWidth={1.8} aria-hidden="true" /> {t('I speak in')}</span>
            <LanguageSelect id="lang" />
          </label>

          <div className="relative mt-2 grid place-items-center">
            {listening && <span aria-hidden="true" className="ks-ring absolute size-40 rounded-full bg-sky/40" />}
            {/* Idle: a slow ring invites the first tap. Off while an entry waits, so only Save glows. */}
            {!listening && !loading && !pending && supported && <span aria-hidden="true" className="ks-ring-idle absolute size-40 rounded-full bg-sky/30" />}
            <button ref={micRef} type="button" id="mic" aria-label={listening ? t('Stop and send') : t('Tap to speak')} aria-pressed={listening} onClick={tap} disabled={loading}
              style={{ boxShadow: '0 16px 40px rgba(0, 186, 242, 0.55), 0 0 0 10px rgba(0, 186, 242, 0.12)' }}
              className={cn('ks-mic relative grid size-40 place-items-center rounded-full bg-sky text-white transition-transform active:scale-95 focus-visible:outline-4 focus-visible:outline-sky/40', !supported && 'opacity-70', listening && 'bg-blue')}>
              {listening ? <Square className="size-14 fill-current" /> : supported ? <Mic className="size-20" strokeWidth={2} /> : <MicOff className="size-20" strokeWidth={2} />}
            </button>
          </div>
          <div className="mt-1 flex h-7 items-center">
            {listening ? <div className="ks-wave flex items-center gap-1" aria-hidden="true"><span /><span /><span /><span /><span /></div>
              : <div className="font-display text-center text-[19px] font-extrabold leading-tight text-blue">{status}</div>}
          </div>
          {listening && <div className="-mt-2 text-[12px] text-ink-2">{status}</div>}

          {/* "or type it": a 44px grey pill with a sky send button. */}
          <form onSubmit={submit} className="flex h-11 w-full items-center gap-2 rounded-full bg-chip pl-4 pr-0 focus-within:ring-2 focus-within:ring-sky/40">
            <input ref={inputRef} id="typeInput" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" aria-label={t('Type an entry or a question')}
              placeholder={correctionHint ? t('Correct it: "No, 150"') : t('or type it')}
              className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3" />
            {/* 44px send target: the sky circle fills the pill's right end (spec "sky send button"; a11y tap target >= 44). */}
            <button type="submit" aria-label={t('Send')} disabled={loading} className="grid size-11 shrink-0 place-items-center rounded-full bg-sky text-white transition-transform duration-150 ease-out active:scale-[0.92] disabled:opacity-50"><Send className="size-[18px]" strokeWidth={2} /></button>
          </form>
        </div>
      </PaytmCard>

      {after}

      {/* While listening, a full-screen sheet with "Listening…" in the merchant's language and tappable example bubbles. */}
      {createPortal(
        <ListeningSheet open={listening} lang={lang} heard={serverVoice ? '' : ws.interim} onStop={tap} onCancel={cancel} onPick={pick} />,
        document.getElementById('ks-frame') ?? document.body,
      )}
    </>
  );
}
