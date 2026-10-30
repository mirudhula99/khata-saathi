// Hear, fallback path: the browser's Web Speech API (Chrome / Edge). Used only when the server has no Sarvam key.
import { useCallback, useEffect, useRef, useState } from 'react';

interface SRAlternative { transcript: string }
interface SRResult { isFinal: boolean; 0: SRAlternative; length: number }
interface SREvent { resultIndex: number; results: ArrayLike<SRResult> }
interface SRErrorEvent { error: string }
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((ev: SREvent) => void) | null;
  onerror: ((ev: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SRCtor = new () => SpeechRecognitionLike;

function getCtor(): SRCtor | null {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useSpeech(lang: string, onFinal: (text: string) => void) {
  const [supported] = useState(() => typeof window !== 'undefined' && getCtor() !== null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef(onFinal);
  useEffect(() => { onFinalRef.current = onFinal; }, [onFinal]);

  const stop = useCallback(() => { recRef.current?.stop(); }, []);
  const cancelled = useRef(false);
  /** Stop WITHOUT sending what was heard (the listening sheet's ✕, or tapping an example bubble instead). */
  const cancel = useCallback(() => { if (recRef.current) { cancelled.current = true; recRef.current.abort(); } }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) { setInterim('Mic needs Chrome or Edge. Use the text box instead.'); return; }
    if (recRef.current && listening) { recRef.current.stop(); return; }
    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let finalText = '';
    rec.onstart = () => { setListening(true); setInterim('Listening…'); if ('speechSynthesis' in window) speechSynthesis.cancel(); };
    rec.onresult = (ev) => {
      let partial = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finalText += r[0].transcript; else partial += r[0].transcript;
      }
      setInterim(finalText || partial || '…');
    };
    rec.onerror = (ev) => setInterim(`Mic error: ${ev.error}. Type instead.`);
    rec.onend = () => {
      setListening(false);
      if (cancelled.current) { cancelled.current = false; setInterim(''); return; }
      if (finalText.trim()) { setInterim(''); onFinalRef.current(finalText.trim()); }
      else setInterim((s) => (s.startsWith('Mic error') ? s : 'Did not catch that. Tap again or type.'));
    };
    try { rec.start(); } catch { setInterim('Could not start the mic. Type instead.'); }
  }, [lang, listening]);

  return { supported, listening, interim, start, stop, cancel, setInterim };
}
