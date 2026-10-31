// Types mirror what app/main.py + app/services.py actually return. Money is whole rupees (the server converts paise).

export type LangCode = 'hi-IN' | 'kn-IN' | 'ta-IN' | 'te-IN' | 'en-IN';
export type Consent = 'pending' | 'granted' | 'opted_out';

/** GET /api/health */
export interface Health {
  voice: boolean;
  llm: boolean;
  tts: boolean;
  ffmpeg: boolean;
  messaging: string;
  payments: string;
  public_base_url: string;
  demo_mode: boolean;
}

/** services.customer_dict */
export interface Customer {
  id: number;
  name: string;
  name_latin: string | null;
  note: string;
  phone: string | null;
  language: string;
  consent: Consent;
  reminders_paused: boolean;
  /** Merchant's own line added to this customer's reminders (the link and STOP line are always appended). */
  reminder_note: string | null;
  balance: number;
}

/** Row in GET /api/state .customers */
export interface CustomerRowData extends Customer {
  days: number;
  disputes: number;
}

export interface Stats {
  oldest_unpaid_days: number;
  avg_days_to_clear: number | null;
  credits_cleared: number;
  balance: number;
  last_payment_days_ago: number | null;
  credits_count: number;
  repayments_count: number;
}

export type EntryType = 'credit' | 'repayment' | 'cash_sale' | 'reversal' | 'adjustment';
/** services.entry_dict */
export interface Entry {
  id: number;
  type: EntryType;
  amount: number;
  items: string[];
  source: string; // voice | cash | mock | paytm | manual | seed
  status: 'active' | 'disputed';
  customer_ack: string | null; // null | ack | disputed | kept | removed
  reverses_entry_id: number | null;
  change: number; // signed rupees: + owes more, - owes less (adjustments use it for direction)
  created_at: string;
}

/** GET /api/customers/{id} */
export interface CustomerDetail extends Customer {
  stats: Stats;
  entries: Entry[];
  next_reminder_at: string | null;
}

export type PendingKind = 'add_credit' | 'record_repayment' | 'cash_sale' | 'request_payment';
/** services.pending_dict: a parsed command waiting for the merchant's yes. */
export interface Pending {
  id: number;
  kind: PendingKind;
  state: 'awaiting_confirm' | 'awaiting_choice';
  transcript: string;
  amount: number | null;
  items: string[];
  payment_mode: 'cash' | 'paytm' | null;
  spoken_name: string | null;
  customer: Customer | null;
  new_customer_name: string | null;
  options: Customer[];
}

export interface Parsed {
  intent: string;
  customer_name: string | null;
  amount: number | null;
  items: string[];
  payment_mode: string | null;
  question: string | null;
  needs_clarification: boolean;
  source: string;
  warning: string | null;
}

/** POST /api/command, /api/voice, /api/actions/... */
export interface CommandResponse {
  transcript: string | null;
  parsed: Parsed | null;
  reply_text: string;
  speak_text: string;
  reply_audio_url: string | null;
  reply_lang: string;
  pending: Pending | null;
  warning: string | null;
  done: { type: string; entry_id?: number; customer_id?: number } | null;
}

/** GET /api/notifications: tasks and alerts derived from the ledger. */
export type NotificationCategory = 'action' | 'payments' | 'reminders' | 'customers';
export interface Notification {
  id: string;
  kind: string;
  category: NotificationCategory;
  customer_id: number | null;
  customer_name: string | null;
  title: string;
  body: string;
  amount: number | null;
  at: string;
  urgent: boolean;
  action: { label: string; to: string } | null;
}
export interface Notifications { items: Notification[]; counts: Partial<Record<NotificationCategory, number>>; now: string }

/** GET /api/stats: numbers for the home-screen charts. Rupees. */
export interface Stats {
  week: { days: { date: string; label: string; given: number; received: number }[]; given: number; received: number };
  outstanding: { customer_id: number; name: string; note: string; balance: number; days: number }[];
}

/** GET /api/state */
export interface State {
  merchant: { id: number; shop_name: string; language: string; phone: string | null };
  customers: CustomerRowData[];
  totals: { owing_count: number; total: number };
  pending: Pending | null;
  health: Health;
  clock_offset_days: number;
  join_url: string;
}

export interface Message {
  id: number;
  direction: 'out' | 'in';
  channel: string;
  kind: string;
  body: string;
  buttons: { id: string; title: string }[];
  link_url: string | null;
  status: string;
  created_at: string;
}

/** GET /api/customer-view/{id} */
export interface CustomerView { customer: Customer; shop: string; messages: Message[] }

export interface ClockInfo { offset_days: number; now: string }

/** Server-sent event on channel merchant:<id> */
export interface MerchantEvent {
  type: 'refresh' | 'payment' | 'dispute' | 'joined' | 'reminder_sent' | string;
  text?: string;
  speak_text?: string;
  lang?: string;
  customer_id?: number;
  entry_id?: number;
}

export interface CustomerPatch {
  name?: string;
  balance?: number; // what the customer owes now; the server books the difference as an adjustment
  phone?: string | null;
  note?: string | null;
  language?: string | null;
  consent?: Consent | null;
  reminders_paused?: boolean | null;
  reminder_note?: string | null;
}
