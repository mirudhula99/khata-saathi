// Zustand store over the FastAPI backend. The UI is thin: app/understand.py interprets, app/ledger.py does every rupee,
// app/services.py composes the replies (in the merchant's language). Nothing is saved without the merchant's yes.
import { create } from 'zustand';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { tNow } from '@/lib/i18n';
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
  viaVoice: boolean;                   // the current entry was spoken: only then are Saathi's replies read aloud

  refresh: () => Promise<void>;
  setLang: (l: LangCode) => Promise<void>;
  updateShop: (shop: { shop_name: string; phone: string }) => Promise<boolean>;
  command: (text: string, customerId?: number, viaVoice?: boolean) => Promise<void>;
  addCustomer: (name: string) => Promise<number | null>;
  formEntry: (text: string, expect: { amount: number; customerId?: number }) => Promise<void>;
  voice: (blob: Blob, filename: string) => Promise<void>;
  confirm: () => Promise<void>;
  reject: () => Promise<void>;
  correct: (amount: number) => Promise<void>;
  choose: (customerId: number) => Promise<void>;
  newCustomer: () => Promise<void>;
  dismiss: () => void;
  remindNow: (customerId: number) => Promise<void>;
  sendStatement: (customerId: number) => Promise<void>;
  removeCustomer: (customerId: number) => Promise<boolean>;
  patchCustomer: (customerId: number, patch: CustomerPatch) => Promise<boolean>;
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
    // Typed or by-hand entries stay quiet (the merchant is looking at the screen); spoken ones are answered aloud.
    // Save / Cancel / correct / choose keep the mode of the entry they belong to.
    if (get().viaVoice) speak(res.speak_text, res.reply_lang, res.reply_audio_url);
    if (res.done) {
      set((s) => ({ doneSeq: s.doneSeq + 1 }));
      toast.success(res.done.type === 'request' ? tNow('Payment link sent') : tNow('Saved'), { description: res.reply_text });
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
    state: null, error: null, loading: false, lang: 'kn-IN',
    pending: null, lastReply: null, lastTranscript: null, lastWarning: null, lastDone: null, doneSeq: 0, viaVoice: false,

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

    updateShop: async (shop) => {
      try {
        await api.patchMerchant(shop);
        toast.success(tNow('Shop details saved'));
        await get().refresh();
        return true;
      } catch (e) { toast.error(errMsg(e)); return false; }
    },

    command: async (text, customerId, viaVoice = false) => { const t = text.trim(); if (!t) return; set({ viaVoice }); await run(() => api.command(t, get().lang, customerId)); },
    addCustomer: async (name) => {
      try {
        const c = await api.addCustomer({ name });
        toast.success(tNow('Customer added'), { description: c.name });
        await get().refresh();
        return c.id;
      } catch (e) { toast.error(errMsg(e)); return null; }
    },
    // By-hand forms (Add by hand, Record payment): the merchant already chose the customer and typed the amount, so
    // tapping the form's button is the "yes" and there is no second read-back. The server still checks everything;
    // it is confirmed only if it understood exactly the form (same customer, or truly new; same amount). Otherwise
    // the read-back shows as for voice, so nothing different from the form is ever saved without a look.
    formEntry: async (text, expect) => {
      const t = text.trim(); if (!t) return;
      set({ viaVoice: false });
      await run(async () => {
        const res = await api.command(t, get().lang, expect.customerId);
        const p = res.pending;
        const sameCustomer = expect.customerId != null ? p?.customer?.id === expect.customerId : p != null && !p.customer;
        // Over the customer's credit limit: show the warning read-back instead of saving straight away.
        if (p && p.state === 'awaiting_confirm' && p.amount === expect.amount && sameCustomer && !p.over_limit) return api.confirm(p.id, get().lang);
        return res;
      });
    },
    voice: async (blob, filename) => { set({ viaVoice: true }); await run(() => api.voice(blob, filename, get().lang)); },

    confirm: async () => { const id = pendingId(); if (id == null) return; await run(() => api.confirm(id, get().lang)); },
    reject: async () => { const id = pendingId(); if (id == null) { set({ pending: null }); return; } await run(() => api.reject(id, get().lang)); },
    correct: async (amount) => { const id = pendingId(); if (id == null) return; await run(() => api.correct(id, amount)); },
    choose: async (customerId) => { const id = pendingId(); if (id == null) return; await run(() => api.choose(id, customerId)); },
    newCustomer: async () => { const id = pendingId(); if (id == null) return; await run(() => api.newCustomer(id)); },
    dismiss: () => set({ lastReply: null, lastTranscript: null, lastWarning: null, lastDone: null }),

    remindNow: async (customerId) => {
      try {
        const r = await api.remindNow(customerId);
        const c = get().state?.customers.find((x) => x.id === customerId);
        if (r.scheduled_for) {
          const at = new Date(r.scheduled_for).toLocaleString('en-IN', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
          toast.success(tNow('Reminder scheduled'), { description: tNow('Outside reminder hours, so it goes to {name} at {at}.', { name: c?.name ?? tNow('them'), at }) });
        } else {
          toast.success(tNow('Reminder sent'), { description: c ? tNow('{name} · {amount} · with a payment link', { name: c.name, amount: inr(c.balance) }) : undefined });
        }
        await get().refresh();
      } catch (e) { toast.error(errMsg(e)); }
    },
    removeCustomer: async (customerId) => {
      try {
        const r = await api.deleteCustomer(customerId);
        toast.success(tNow('Customer removed'), { description: r.name });
        await get().refresh();
        return true;
      } catch (e) { toast.error(errMsg(e)); return false; }
    },
    sendStatement: async (customerId) => {
      try {
        await api.sendStatement(customerId);
        const c = get().state?.customers.find((x) => x.id === customerId);
        toast.success(tNow('Statement sent'), { description: c ? (c.balance > 0 ? tNow('{name} · {amount} due, with a payment link', { name: c.name, amount: inr(c.balance) }) : tNow('{name} · nothing due', { name: c.name })) : undefined });
        await get().refresh();
      } catch (e) { toast.error(errMsg(e)); }
    },
    patchCustomer: async (customerId, patch) => {
      try { await api.patchCustomer(customerId, patch); set((s) => ({ doneSeq: s.doneSeq + 1 })); await get().refresh(); return true; } catch (e) { toast.error(errMsg(e)); return false; }
    },
    resolveDispute: async (entryId, action) => {
      try {
        const r = await api.resolveDispute(entryId, action);
        toast.success(action === 'keep' ? tNow('Entry kept') : tNow('Entry removed'), { description: tNow('Balance now {amount}', { amount: inr(r.balance) }) });
        set((s) => ({ doneSeq: s.doneSeq + 1 }));
        await get().refresh();
      } catch (e) { toast.error(errMsg(e)); }
    },
    fastForward: async (days = 3) => {
      try {
        const r = await api.fastForward(days);
        toast.success(tNow('Moved {n} days forward', { n: days }), { description: tNow(r.reminders_sent === 1 ? '{n} reminder sent · demo time +{d} days' : '{n} reminders sent · demo time +{d} days', { n: r.reminders_sent, d: r.offset_days }) });
        await get().refresh();
      } catch (e) { toast.error(errMsg(e)); }
    },
    runReminders: async () => {
      try { const r = await api.runReminders(); toast(tNow(r.reminders_sent === 1 ? '{n} reminder sent' : '{n} reminders sent', { n: r.reminders_sent })); await get().refresh(); } catch (e) { toast.error(errMsg(e)); }
    },
    reset: async () => {
      try { await api.reset(); set({ pending: null, lastReply: null, lastTranscript: null, lastWarning: null, lastDone: null }); await get().refresh(); toast(tNow('Demo data reset')); } catch (e) { toast.error(errMsg(e)); }
    },
  };
});
