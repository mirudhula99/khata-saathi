// Typed client for the FastAPI routes in app/main.py. Same-origin in the built app; proxied to :8000 in `npm run dev`.
import type {
  ClockInfo, CommandResponse, CustomerDetail, CustomerPatch, CustomerView, Health, State, Stats, Notifications,
} from './types';

type Method = 'GET' | 'POST' | 'PATCH';

async function request<T>(path: string, opts: { method?: Method; body?: unknown; form?: FormData } = {}): Promise<T> {
  const init: RequestInit = { method: opts.method ?? (opts.body !== undefined || opts.form ? 'POST' : 'GET'), headers: {} };
  if (opts.form) init.body = opts.form;
  else if (opts.body !== undefined) { (init.headers as Record<string, string>)['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
  const res = await fetch(path, init);
  let data: unknown = {};
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    // FastAPI puts user-facing errors in {detail}. FlowError/SarvamError/AudioError all arrive this way.
    const detail = (data as { detail?: unknown }).detail;
    throw new Error(typeof detail === 'string' ? detail : `Request failed (${res.status}). Try again.`);
  }
  return data as T;
}

export const api = {
  health: () => request<Health>('/api/health'),
  state: () => request<State>('/api/state'),
  stats: () => request<Stats>('/api/stats'),
  notifications: () => request<Notifications>('/api/notifications'),
  patchMerchant: (body: { language?: string; shop_name?: string; phone?: string }) => request<{ ok: true }>('/api/merchant', { method: 'PATCH', body }),

  // Understand: text or a recording → read-back (pending) or an answer.
  // customerId: the screen already shows one customer, so the server skips name matching (no "Which Ramesh?").
  command: (text: string, lang: string, customerId?: number) => request<CommandResponse>('/api/command', { body: { text, lang, customer_id: customerId ?? null } }),
  voice: (blob: Blob, filename: string, lang: string) => {
    const form = new FormData();
    form.append('file', blob, filename);
    form.append('lang', lang);
    return request<CommandResponse>('/api/voice', { form });
  },

  // Pending actions: nothing is saved without the merchant's yes.
  confirm: (id: number, lang: string) => request<CommandResponse>(`/api/actions/${id}/confirm`, { body: { lang } }),
  reject: (id: number, lang: string) => request<CommandResponse>(`/api/actions/${id}/reject`, { body: { lang } }),
  correct: (id: number, amount: number) => request<CommandResponse>(`/api/actions/${id}/correct`, { body: { amount } }),
  choose: (id: number, customer_id: number) => request<CommandResponse>(`/api/actions/${id}/choose`, { body: { customer_id } }),
  newCustomer: (id: number) => request<CommandResponse>(`/api/actions/${id}/new-customer`, { body: {} }),

  // Record
  customer: (id: number) => request<CustomerDetail>(`/api/customers/${id}`),
  addCustomer: (body: { name: string; phone?: string; note?: string }) => request<CustomerDetail>('/api/customers', { body }),
  patchCustomer: (id: number, body: CustomerPatch) => request<CustomerDetail>(`/api/customers/${id}`, { method: 'PATCH', body }),
  resolveDispute: (entryId: number, action: 'keep' | 'remove') => request<{ ok: true; balance: number }>(`/api/entries/${entryId}/resolve`, { body: { action } }),
  customerView: (id: number) => request<CustomerView>(`/api/customer-view/${id}`),

  // Act
  remindNow: (id: number) => request<{ ok: true }>(`/api/customers/${id}/remind`, { body: {} }),
  tts: (text: string, lang: string) => request<{ audio_url: string | null }>(`/api/tts?lang=${encodeURIComponent(lang)}&text=${encodeURIComponent(text)}`),

  // Demo controls (DEMO_MODE=true)
  clock: () => request<ClockInfo>('/api/demo/clock'),
  fastForward: (days = 3) => request<{ offset_days: number; reminders_sent: number }>('/api/demo/fast-forward', { body: { days } }),
  runReminders: () => request<{ reminders_sent: number }>('/api/demo/run-reminders', { body: {} }),
  reset: () => request<{ ok: true }>('/api/demo/reset', { body: {} }),
};
