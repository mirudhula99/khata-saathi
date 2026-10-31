import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Languages, Pencil, Search, Users, type LucideIcon } from 'lucide-react';
import { AppShell, HeaderBand, Scroll } from '@/components/AppShell';
import { CustomerEditSheet } from '@/components/CustomerEditSheet';
import { DemoSheet } from '@/components/DemoSheet';
import { LanguageSelect } from '@/components/LanguageSelect';
import { PaytmBadge, PaytmButton, PaytmCard, PaytmRow } from '@/components/paytm';
import { Input } from '@/components/ui/input';
import type { CustomerRowData } from '@/lib/types';
import { cn, inr } from '@/lib/utils';
import { useKhata } from '@/store/useKhata';

/** 40px sky-tint circle with a blue line icon: the row avatar for non-customer rows (spec section 4 List row). */
function IconCircle({ icon: Icon, muted, className }: { icon: LucideIcon; muted?: boolean; className?: string }) {
  return (
    <span className={cn('grid size-10 shrink-0 place-items-center rounded-full', muted ? 'bg-chip text-ink-3' : 'bg-sky-tint text-blue', className)} aria-hidden="true">
      <Icon className="size-5" strokeWidth={1.8} />
    </span>
  );
}


/** More: shop details, language, editing customers (name, mobile, unique label, amount owed), and what's coming. */
export function AccountPage() {
  const { state, updateShop, loading } = useKhata();
  const name = state?.merchant.shop_name ?? 'Khata Saathi';
  const phone = state?.merchant.phone ?? '';

  // Shop details: shown as a row, edited inline.
  const [editing, setEditing] = useState(false);
  const [shopName, setShopName] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [error, setError] = useState('');
  const startEdit = () => { setShopName(name); setShopPhone(phone); setError(''); setEditing(true); };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const digits = shopPhone.replace(/\D/g, '');
    if (!shopName.trim()) { setError('Enter the shop name.'); return; }
    if (shopPhone.trim() && digits.length < 10) { setError('Enter a 10-digit mobile number, or leave it empty.'); return; }
    if (await updateShop({ shop_name: shopName.trim(), phone: shopPhone.trim() })) setEditing(false);
  };

  // Customers: search by name, unique label or mobile; tap one to edit.
  const [query, setQuery] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const customers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...(state?.customers ?? [])]
      .filter((c) => !q || c.name.toLowerCase().includes(q) || (c.note ?? '').toLowerCase().includes(q) || (c.phone ?? '').includes(q))
      .sort((a, b) => a.name.localeCompare(b.name) || (a.note ?? '').localeCompare(b.note ?? ''));
  }, [state, query]);
  const editingCustomer: CustomerRowData | null = state?.customers.find((c) => c.id === editId) ?? null;

  // Hidden demo tools: hold the "More" title for a second (DEMO_MODE only). No visible hint, by design.
  const [demo, setDemo] = useState(false);
  const hold = useRef(0);
  const demoOn = Boolean(state?.health.demo_mode);
  const press = () => { if (demoOn) hold.current = window.setTimeout(() => setDemo(true), 900); };
  const release = () => window.clearTimeout(hold.current);
  const title = (
    <span className="select-none [-webkit-touch-callout:none]" onPointerDown={press} onPointerUp={release} onPointerLeave={release}
      onPointerCancel={release} onContextMenu={(e) => e.preventDefault()}>More</span>
  );

  return (
    <AppShell>
      <HeaderBand title={title} />
      <Scroll className="pb-6">
        <div className="flex flex-col gap-3 px-4 pt-1">
          <PaytmCard title="Shop" padded={false}>
            {editing ? (
              <form onSubmit={(e) => void save(e)} className="flex flex-col gap-2 px-4 pb-4 pt-1">
                <label className="text-[12px] font-medium text-ink-2" htmlFor="shopName">Shop name</label>
                <Input id="shopName" value={shopName} onChange={(e) => setShopName(e.target.value)} maxLength={120} autoComplete="organization" autoFocus />
                <label className="mt-1 text-[12px] font-medium text-ink-2" htmlFor="shopPhone">Mobile number</label>
                <Input id="shopPhone" value={shopPhone} onChange={(e) => setShopPhone(e.target.value)} inputMode="tel" maxLength={20} autoComplete="tel" placeholder="Optional" />
                {error && <p className="text-[12px] text-error-ink">{error}</p>}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <PaytmButton variant="ghost" full onClick={() => setEditing(false)}>Cancel</PaytmButton>
                  <PaytmButton type="submit" variant="primary" full disabled={loading}>Save</PaytmButton>
                </div>
              </form>
            ) : (
              <PaytmRow avatar={name} title={name} sub={phone || 'Add your mobile number'} onClick={startEdit}
                right={<span className="flex items-center gap-1 text-[13px] font-semibold text-blue"><Pencil className="size-4" strokeWidth={2} aria-hidden="true" />Edit</span>} />
            )}
            <PaytmRow avatar={<IconCircle icon={Languages} />} title={<label htmlFor="lang">I speak, Saathi replies in</label>} right={<LanguageSelect id="lang" />} />
          </PaytmCard>

          <PaytmCard title="Customers" subtitle="Tap a customer to change their name, mobile, unique label, or what they owe." padded={false}>
            <div className="px-4 pb-2">
              <label className="flex h-11 items-center gap-2 rounded-full bg-chip px-4 focus-within:ring-2 focus-within:ring-sky/40">
                <Search className="size-4 shrink-0 text-ink-3" strokeWidth={2} aria-hidden="true" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, unique label or mobile" aria-label="Search customers"
                  className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-3" />
              </label>
            </div>
            {customers.map((c) => (
              <PaytmRow key={c.id} avatar={c.name} title={c.name} sub={[c.note, c.phone].filter(Boolean).join(' · ') || 'No mobile or street yet'}
                right={<span className={cn('tabular-nums', c.balance > 0 ? 'text-owed' : 'text-paid')}>{c.balance > 0 ? inr(c.balance) : 'Paid up'}</span>}
                chevron onClick={() => setEditId(c.id)} />
            ))}
            {customers.length === 0 && <p className="px-4 pb-4 text-[13px] text-ink-2">No customer matches “{query}”.</p>}
          </PaytmCard>

          <PaytmCard title="Coming soon" padded={false}>
            <PaytmRow avatar={<IconCircle icon={Users} muted />} title="Family khata" sub="One account for a household" rightSub={<PaytmBadge tone="grey">Soon</PaytmBadge>} disabled />
          </PaytmCard>

          <p className="pt-1 text-center text-[11px] text-ink-2">Khata Saathi · Team Rupeeriot · Paytm Build for India AI Hackathon, Bengaluru</p>
        </div>
      </Scroll>
      <CustomerEditSheet customer={editingCustomer} onOpenChange={(o) => { if (!o) setEditId(null); }} />
      {demoOn && <DemoSheet open={demo} onOpenChange={setDemo} />}
    </AppShell>
  );
}
