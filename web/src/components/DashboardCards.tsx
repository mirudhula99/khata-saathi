import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { OwedBars, WeekColumns } from '@/components/Charts';
import { Affordance, PaytmCard } from '@/components/paytm';
import { api } from '@/lib/api';
import type { Stats } from '@/lib/types';
import { inr } from '@/lib/utils';
import { useKhata } from '@/store/useKhata';

/**
 * Home-screen dashboard: two cards fed by GET /api/stats (his ledger, read-only).
 * Refetches whenever the app state changes (after a save, a payment, a reminder or the demo clock),
 * so the bars move during the demo: Lakshmi pays → "Money received" grows, her bar disappears.
 */
export function DashboardCards() {
  const state = useKhata((s) => s.state);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api.stats().then((s) => { if (alive) { setStats(s); setError(''); } }).catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [state]);

  const totals = state?.totals;
  const pendingLine = totals ? (totals.total > 0 ? `${inr(totals.total)} pending · ${totals.owing_count} customer${totals.owing_count === 1 ? '' : 's'}` : 'All settled') : '';

  return (
    <>
      <PaytmCard title="Who owes you" subtitle={pendingLine} action={<Affordance><Link to="/khata">Open khata</Link></Affordance>}>
        {stats ? <OwedBars rows={stats.outstanding} /> : <div className="h-24 animate-pulse rounded-lg bg-chip" aria-hidden="true" />}
        {error && <p className="mt-2 text-[12px] text-ink-2">{error}</p>}
      </PaytmCard>

      <PaytmCard title="This week" subtitle={stats ? `${inr(stats.week.received)} received · ${inr(stats.week.given)} udhaar given` : 'Udhaar given vs money received, per day'}>
        {stats ? <WeekColumns days={stats.week.days} /> : <div className="h-36 animate-pulse rounded-lg bg-chip" aria-hidden="true" />}
      </PaytmCard>
    </>
  );
}
