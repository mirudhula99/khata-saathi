// Small presentational helpers. Design spec: ../../../.superdesign/design-system.md
import { tNow } from './i18n';
import type { LangCode } from './types';

export const initial = (name: string) => (name.trim()[0] ?? '?').toUpperCase();

/** "Today, 4:12 pm" / "Yesterday" / "12 Oct" from an ISO UTC timestamp. The words follow the merchant's language. */
export function timeAgo(iso: string) {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const days = Math.floor((Date.now() - then.getTime()) / 86400000);
  if (days <= 0) return tNow('Today, {time}', { time: then.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) });
  if (days === 1) return tNow('Yesterday');
  return then.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** "3 Nov, 9:00 am" for a time ahead (timeAgo only reads the past). An absolute date, because on the demo clock
 *  the scheduler's "today" can be days ahead of the phone's. */
export function dateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
}

/** Greeting in the merchant's language (design-system §4 Header band). */
export function greeting(lang: string): string {
  const g: Record<string, string> = { 'ta-IN': 'Vanakkam', 'hi-IN': 'Namaste', 'kn-IN': 'Namaskara', 'te-IN': 'Namaskaram', 'en-IN': 'Hello' };
  return g[lang] ?? 'Namaste';
}

/** "Listening…" in the merchant's language (native script) with the helper line under it, for the listening sheet. */
export function listeningLabel(lang: string): { native: string; en: string } {
  const l: Record<string, string> = { 'ta-IN': 'கேட்கிறேன்…', 'hi-IN': 'सुन रहा हूँ…', 'kn-IN': 'ಕೇಳುತ್ತಿದ್ದೇನೆ…', 'te-IN': 'వింటున్నాను…', 'en-IN': 'Listening…' };
  return { native: l[lang] ?? 'Listening…', en: tNow('Listening… speak now') };
}

/**
 * Suggestion chips. Native script is what the merchant sees; `send` is the sentence that goes to /api/command.
 * Without a Sarvam key the server uses its rule-based parser, so `send` sticks to sentences that parser handles
 * (seed customers: Lakshmi, two Rameshes, Ravi). With the LLM on, anything goes.
 */
export const SUGGESTIONS: Record<LangCode, { native: string; send: string }[]> = {
  'ta-IN': [
    { native: 'லட்சுமிக்கு 150 கடன், 2 கிலோ அரிசி', send: 'Lakshmi ku 150 rupees udhaar, 2 kg rice' },
    { native: 'யார் யார் கடன் இருக்கு?', send: 'Who owes me money?' },
    { native: 'ரமேஷ் 300 ரொக்கமா கொடுத்தார்', send: 'Ramesh paid 300 cash' },
    { native: 'ரவி எவ்வளவு தர வேண்டும்?', send: 'How much does Ravi owe?' },
    { native: 'ரவி கிட்ட 290 கேளு', send: 'Ask Ravi for 290' },
  ],
  'hi-IN': [
    { native: 'लक्ष्मी को 150 उधार, 2 किलो चावल', send: 'Lakshmi ku 150 rupees udhaar, 2 kg rice' },
    { native: 'किस किस का पैसा बाकी है?', send: 'Who owes me money?' },
    { native: 'रमेश ने 300 नकद दिए', send: 'Ramesh paid 300 cash' },
    { native: 'रवि पर कितना बकाया है?', send: 'How much does Ravi owe?' },
    { native: 'रवि से 290 माँगो', send: 'Ask Ravi for 290' },
  ],
  'kn-IN': [
    { native: 'ಲಕ್ಷ್ಮಿಗೆ 150 ಸಾಲ, 2 ಕೆಜಿ ಅಕ್ಕಿ', send: 'Lakshmi ku 150 rupees udhaar, 2 kg rice' },
    { native: 'ಯಾರು ಯಾರು ಸಾಲ ಇದೆ?', send: 'Who owes me money?' },
    { native: 'ರಮೇಶ್ 300 ನಗದು ಕೊಟ್ರು', send: 'Ramesh paid 300 cash' },
    { native: 'ರವಿ ಎಷ್ಟು ಕೊಡಬೇಕು?', send: 'How much does Ravi owe?' },
    { native: 'ರವಿ ಹತ್ರ 290 ಕೇಳು', send: 'Ask Ravi for 290' },
  ],
  'te-IN': [
    { native: 'లక్ష్మికి 150 అప్పు, 2 కిలో బియ్యం', send: 'Lakshmi ku 150 rupees udhaar, 2 kg rice' },
    { native: 'ఎవరెవరు అప్పు ఉంది?', send: 'Who owes me money?' },
    { native: 'రమేష్ 300 నగదు ఇచ్చాడు', send: 'Ramesh paid 300 cash' },
    { native: 'రవి ఎంత ఇవ్వాలి?', send: 'How much does Ravi owe?' },
    { native: 'రవి ని 290 అడుగు', send: 'Ask Ravi for 290' },
  ],
  'en-IN': [
    { native: 'Lakshmi ku 150 rupees udhaar, 2 kg rice', send: 'Lakshmi ku 150 rupees udhaar, 2 kg rice' },
    { native: 'Who owes me money?', send: 'Who owes me money?' },
    { native: 'Ramesh paid 300 cash', send: 'Ramesh paid 300 cash' },
    { native: 'How much does Ravi owe?', send: 'How much does Ravi owe?' },
    { native: 'Ask Ravi for 290', send: 'Ask Ravi for 290' },
  ],
};

/** English labels per action kind; these are translation keys, so render them through `t(KIND_LABEL[kind])`. */
export const KIND_LABEL: Record<string, string> = {
  add_credit: 'Udhaar',
  record_repayment: 'Payment received',
  cash_sale: 'Cash sale',
  request_payment: 'Payment link',
};
