import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, Search, UserPlus, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { AppShell, HeaderBand, Scroll } from '@/components/AppShell';
import { Affordance, PaytmCard, PaytmChip, TopBarIcon } from '@/components/paytm';

/** Rows shown before a "Show N more" step. Pending lists are short; Settled and All grow only when the merchant asks. */
const PAGE = 8;
import { CustomerRow } from '@/components/CustomerRow';
import { inr } from '@/lib/utils';
import { useKhata } from '@/store/useKhata';

/**
 * Khata tab, Paytm edition (spec section 5): wordmark top bar with the Add-customer icon, then a "Who owes you" card
 * (subtitle = the pending total, Search affordance opens a chip-pill search field under the title) with the pending rows,
 * then a "Settled" card. The ledger is second to the voice.
 */
export function KhataPage() {
  const state = useKhata((s) => s.state);
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  // One list, three filters, paging. Pending is the default so the page opens on the people who matter today and ends there.
  const [filter, setFilter] = useState<'pending' | 'settled' | 'all'>('pending');
  const [shown, setShown] = useState(PAGE);
  const customers = state?.customers ?? [];
  const pendingAll = customers.filter((c) => c.balance > 0);
  const settledAll = customers.filter((c) => c.balance <= 0);
  const query = q.trim().toLowerCase();
  const matches = (c: (typeof customers)[number]) => !query || c.name.toLowerCase().includes(query) || c.note.toLowerCase().includes(query);
  // Search looks across everyone regardless of the filter ("where is Anitha" must not depend on the tab).
  const source = query ? customers : filter === 'pending' ? pendingAll : filter === 'settled' ? settledAll : customers;
  const byDays = (a: (typeof customers)[number], b: (typeof customers)[number]) => b.days - a.days || b.balance - a.balance;
  const byName = (a: (typeof customers)[number], b: (typeof customers)[number]) => a.name.localeCompare(b.name);
  // Pending stays sorted by days outstanding; settled is alphabetical; "All" lists pending first, then settled by name.
  const list = source.filter(matches).sort((a, b) => (a.balance > 0 && b.balance > 0 ? byDays(a, b) : a.balance > 0 ? -1 : b.balance > 0 ? 1 : byName(a, b)));
  const visible = list.slice(0, shown);
  const hidden = list.length - visible.length;
  const showSearch = searching || q.length > 0;
  // Search opens the pill; Close hides it AND clears the query, otherwise a typed query would keep the field (and the filter) alive.
  const toggleSearch = () => { if (showSearch) { setQ(''); setSearching(false); } else setSearching(true); };
  const pick = (f: typeof filter) => { setFilter(f); setShown(PAGE); };

  return (
    <AppShell>
      <HeaderBand
        title="Khata"
        topRight={
          <>
            <TopBarIcon icon={UserPlus} label="Add customer" onClick={() => navigate('/add?new=1')} />
            <TopBarIcon icon={Bell} label="Reminders" to="/reminders" className="-mr-2" />
          </>
        }
      />
      <Scroll className="pb-6">
        {!state && <div className="flex flex-col gap-3 px-4 pt-1">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)}</div>}
        {state && (
          <div className="flex flex-col gap-3 px-4 pt-1">
            <PaytmCard
              padded={false}
              title="Who owes you"
              subtitle={state.totals.total > 0 ? <>{inr(state.totals.total)} pending · {state.totals.owing_count} customer{state.totals.owing_count === 1 ? '' : 's'}</> : 'Nobody owes you right now'}
              action={
                <Affordance onClick={toggleSearch} className="-my-2 min-h-11 px-1">
                  {showSearch ? <X className="size-4" strokeWidth={2} /> : <Search className="size-4" strokeWidth={2} />}
                  {showSearch ? 'Close' : 'Search'}
                </Affordance>
              }
            >
              {showSearch && (
                <label className="mx-4 mb-3 flex h-11 items-center gap-2 rounded-full bg-chip px-3.5 text-ink-2 focus-within:ring-2 focus-within:ring-sky">
                  <Search className="size-4 shrink-0" strokeWidth={2} />
                  <input id="search" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} placeholder="Search all customers" autoFocus className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3" />
                </label>
              )}
              {/* Segmented filter. While a search is typed it applies to everyone, so the chips step aside. */}
              {!query && (
                <div role="group" aria-label="Show" className="mx-4 mb-3 flex gap-2">
                  <PaytmChip selected={filter === 'pending'} onClick={() => pick('pending')} className="h-9 px-3.5 text-[13px]">Pending · {pendingAll.length}</PaytmChip>
                  <PaytmChip selected={filter === 'settled'} onClick={() => pick('settled')} className="h-9 px-3.5 text-[13px]">Settled · {settledAll.length}</PaytmChip>
                  <PaytmChip selected={filter === 'all'} onClick={() => pick('all')} className="h-9 px-3.5 text-[13px]">All</PaytmChip>
                </div>
              )}
              {list.length === 0 && (
                <div className="px-4 pb-5 pt-2 text-center text-[13px] text-ink-2">
                  {query ? `No customer matches "${q.trim()}".` : filter === 'pending' ? 'Nobody owes you anything.' : filter === 'settled' ? 'Nobody is settled yet.' : 'No customers yet.'}
                </div>
              )}
              {visible.map((c, i) => <CustomerRow key={c.id} c={c} last={i === visible.length - 1} quiet={c.balance <= 0} />)}
              {hidden > 0 && (
                <button type="button" onClick={() => setShown((n) => n + PAGE)} className="flex h-12 w-full items-center justify-center gap-1 border-t border-line text-[14px] font-semibold text-sky-ink active:bg-chip">
                  Show {Math.min(hidden, PAGE)} more <ChevronDown className="size-4" strokeWidth={2} />
                </button>
              )}
            </PaytmCard>
            <p className="px-2 pt-1 text-center text-[12px] text-ink-2">Tap a customer for the actual record. No score, you decide.</p>
          </div>
        )}
      </Scroll>
    </AppShell>
  );
}
