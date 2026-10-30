// Saathi talks back. Sarvam TTS audio when the server returns reply_audio_url, else the browser voice.
import { useEffect, useState } from 'react';
import type { LangCode } from './types';

export const LANGS: { code: LangCode; label: string; glyph: string; native: string }[] = [
  { code: 'ta-IN', label: 'Tamil', glyph: 'த', native: 'தமிழ்' },
  { code: 'kn-IN', label: 'Kannada', glyph: 'ಕ', native: 'ಕನ್ನಡ' },
  { code: 'hi-IN', label: 'Hindi', glyph: 'हि', native: 'हिन्दी' },
  { code: 'te-IN', label: 'Telugu', glyph: 'తె', native: 'తెలుగు' },
  { code: 'en-IN', label: 'English', glyph: 'En', native: 'English' },
];
export const normLang = (code: string | null | undefined): LangCode =>
  (LANGS.some((l) => l.code === code) ? (code as LangCode) : 'en-IN');

// "Is Saathi speaking right now?" drives the thin sky bar on the reply card (design-system §3).
const listeners = new Set<(speaking: boolean) => void>();
let speaking = false;
function setSpeaking(v: boolean) { speaking = v; listeners.forEach((l) => l(v)); }

export function useSpeaking() {
  const [s, setS] = useState(speaking);
  useEffect(() => { listeners.add(setS); return () => { listeners.delete(setS); }; }, []);
  return s;
}

// One shared <audio>; iPhones only play sound after a user gesture, so unlock it on the first tap.
const player = typeof Audio !== 'undefined' ? new Audio() : null;
let unlocked = false;
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
export function unlockAudio() {
  if (unlocked || !player) return;
  unlocked = true;
  player.src = SILENT_WAV;
  player.play().catch(() => { /* fine */ });
}

function browserSpeak(text: string, lang: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/₹/g, ' rupees '));
    u.lang = lang;
    const voices = speechSynthesis.getVoices();
    const v = voices.find((x) => x.lang === lang) || voices.find((x) => x.lang.startsWith(lang.slice(0, 2)));
    if (v) u.voice = v;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    speechSynthesis.speak(u);
  } catch { /* TTS is optional */ }
}

export function speak(text: string, lang: string, audioUrl?: string | null) {
  if (!text) return;
  if (audioUrl && player) {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    player.src = audioUrl;
    player.onplay = () => setSpeaking(true);
    player.onended = () => setSpeaking(false);
    player.onerror = () => { setSpeaking(false); browserSpeak(text, lang); };
    player.play().catch(() => browserSpeak(text, lang));
    return;
  }
  browserSpeak(text, lang);
}
