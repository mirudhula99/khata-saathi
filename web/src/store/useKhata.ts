// Zustand store over the FastAPI backend. The UI is thin: app/understand.py interprets, app/ledger.py does every rupee,
// app/services.py composes the replies (in the merchant's language). Nothing is saved without the merchant's yes.
import { create } from 'zustand';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { normLang, speak, unlockAudio } from '@/lib/speech';
import type { CommandResponse, CustomerPatch, LangCode, Pending, State } from '@/lib/types';
import { inr } from '@/lib/utils';

interface KhataState {
  state: State | null;
  error: string | null;
  loading: boolean;
  lang: LangCode;                      // the merchant's language (server-side setting, mirrored here)
  pending: Pending | null;             // read-back waiting for yes / which-customer choice
  lastReply: string | null;
  lastTranscript: string | null;
  lastWarning: string | null;
  lastDone: CommandResponse['done'];
  doneSeq: number;                     // bumps every time an action completes (screens use it to navigate / refetch)

  refresh: () => Promise<void>;
  setLang: (l: LangCode) => Promise<void>;
  command: (text: string, customerId?: number) => Promise<void>;
  addCustomer: (name: string) => Promise<number | null>;
  voice: (blob: Blob, filename: string) => Promise<void>;
  confirm: () => Promise<void>;
  reject: () => Promise<void>;
  correct: (amount: number) => Promise<void>;
  choose: (customerId: number) => Promise<void>;
  newCustomer: () => Promise<void>;
  dismiss: () => void;
  remindNow: (customerId: number) => Promise<void>;
  patchCustomer: (customerId: number, patch: CustomerPatch) => Promise<void>;
  resolveDispute: (entryId: number, action: 'keep' | 'remove') => Promise<void>;
  fastForward: (days?: number) => Promise<void>;
  runReminders: () => Promise<void>;
  reset: () => Promise<void>;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const useKhata = create<KhataState>((set, get) => {
  const fail = (e: unknown) => { const m = errMsg(e); set({ lastReply: m, lastWarning: 'error' }); toast.error(m); };

  /** Every command / action endpoint returns the same shape; this is the one place it is interpreted. */
  const handle = async (res: CommandResponse) => {
    set({ pending: res.pending, lastReply: res.reply_text, lastTranscript: res.transcript, lastWarning: res.warning, lastDone: res.done });
    speak(res.speak_text, res.reply_lang, res.reply_audio_url);
    if (res.done) {
      set((s) => ({ doneSeq: s.doneSeq + 1 }));
      toast.success(res.done.type === 'request' ? 'Payment link sent' : 'Saved', { description: res.reply_text });
    }
    await get().refresh();
  };
  const run = async (fn: () => Promise<CommandResponse>) => {
    unlockAudio();
    set({ loading: true });
    try { await handle(await fn()); } catch (e) { fail(e); await get().refresh(); } finally { set({ loading: false }); }
  };
  const pendingId = () => get().pending?.id ?? null;

  return {
    state: null, error: null, loading: false, lang: 'ta-IN',
    pending: null, lastReply: null, lastTranscript: null, lastWarning: null, lastDone: null, doneSeq: 0,

    refresh: async () => {
      try {
        const state = await api.state();
        set((s) => ({
          state, error: null, lang: normLang(state.merchant.language),
          // Server is the source of truth for what is waiting: adopt it on first load, drop ours if it expired.
          pending: s.pending && state.pending && s.pending.id === state.pending.id ? state.pending : state.pending && !s.pending && !s.lastReply ? state.pending : state.pending ? s.pending : null,
        }));
      } catch (e) { set({ error: errMsg(e) }); }
    },

    setLang: async (lang) => {
      set({ lang });
      try { await api.patchMerchant({ language: lang }); await get().refresh(); } catch (e) { toast.error(errMsg(e)); }
    },

    command: async (text, customerId) => { const t = text.trim(); if (!t) return; await run(() => api.command(t, get().lang, customerId)); },
    addCustomer: async (name) => {
      try {
        const c = await api.addCustomer({ name });
        toast.success('Customer added', { description: c.name });
        await get().refresh();
        return c.id;
      } catch (e) { toast.error(errMsg(e)); return null; }
    },
    voice: async (blob, filename) => run(() => api.voice(blob, filename, get().lang)),

    confirm: async () => { const id = pendingId(); if (id == null) return; await run(() => api.confirm(id, get().lang)); },
    reject: async () => { const id = pendingId(); if (id == null) { set({ pending: null }); return; } await run(() => api.reject(id, get().lang)); },
    correct: async (amount) => { const id = pendingId(); if (id == null) return; await run(() => api.correct(id, amount)); },
    choose: async (customerId) => { const id = pendingId(); if (id == null) return; await run(() => api.choose(id, customerId)); },
    newCustomer: async () => { const id = pendingId(); if (id == null) return; await run(() => api.newCustomer(id)); },
    dismiss: () => set({ lastReply: null, lastTranscript: null, lastWarning: null, lastDone: null }),

    remindNow: async (customerId) => {
      try {
        await api.remindNow(customerId);
        const c = get().state?.customers.find((x) => x.id === customerId);
        toast.success('Reminder sent', { description: c ? `${c.name} · ${inr(c.balance)} · with a payment link` : undefined });
        await get().refresh();
      } catch (e) { toast.error(errMsg(e)); }
    },
    patchCustomer: async (customerId, patch) => {
      try { await api.patchCustomer(customerId, patch); set((s) => ({ doneSeq: s.doneSeq + 1 })); await get().refresh(); } catch (e) { toast.error(errMsg(e)); }
    },
    resolveDispute: async (entryId, action) => {
      try {
        const r = await api.resolveDispute(entryId, action);
        toast.success(action === 'keep' ? 'Entry kept' : 'Entry removed', { description: `Balance now ${inr(r.balance)}` });
        set((s) => ({ doneSeq: s.doneSeq + 1 }));
        await get().refresh();
      } catch (e) { toast.error(errMsg(e)); }
    },
    fastForward: async (days = 3) => {
      try {
        const r = await api.fastForward(days);
        toast.success(`Moved ${days} days forward`, { description: `${r.reminders_sent} reminder${r.reminders_sent === 1 ? '' : 's'} sent · demo time +${r.offset_days} days` });
        await get().refresh();
      } catch (e) { toast.error(errMsg(e)); }
    },
    runReminders: async () => {
      try { const r = await api.runReminders(); toast(`${r.reminders_sent} reminder${r.reminders_sent === 1 ? '' : 's'} sent`); await get().refresh(); } catch (e) { toast.error(errMsg(e)); }
    },
    reset: async () => {
      try { await api.reset(); set({ pending: null, lastReply: null, lastTranscript: null, lastWarning: null, lastDone: null }); await get().refresh(); toast('Demo data reset'); } catch (e) { toast.error(errMsg(e)); }
    },
  };
});
