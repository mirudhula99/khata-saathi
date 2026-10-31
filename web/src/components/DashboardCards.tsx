import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { OwedBars, WeekColumns } from '@/components/Charts';
import { Affordance, PaytmCard } from '@/components/paytm';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { Stats } from '@/lib/types';
import { inr } from '@/lib/utils';
import { useKhata } from '@/store/useKhata';

/**
 * Home-screen dashboard: two cards fed by GET /api/stats (his ledger, read-only).
 * Refetches whenever the app state changes (after a save, a payment, a reminder or the demo clock),
 * so the bars move during the demo: Lakshmi pays → "Money received" grows, her bar disappears.
 */
export function DashboardCards() {
  const t = useT();
  const state = useKhata((s) => s.state);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api.stats().then((s) => { if (alive) { setStats(s); setError(''); } }).catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [state]);

  const totals = state?.totals;
  const pendingLine = totals
    ? (totals.total > 0
      ? t(totals.owing_count === 1 ? '{amount} pending · {count} customer' : '{amount} pending · {count} customers', { amount: inr(totals.total), count: totals.owing_count })
      : t('All settled'))
    : '';

  return (
    <>
      <PaytmCard title={t('Who owes you')} subtitle={pendingLine} action={<Affordance><Link to="/khata">{t('Open khata')}</Link></Affordance>}>
        {stats ? <OwedBars rows={stats.outstanding} /> : <div className="h-24 animate-pulse rounded-lg bg-chip" aria-hidden="true" />}
        {error && <p className="mt-2 text-[12px] text-ink-2">{error}</p>}
      </PaytmCard>

      <PaytmCard title={t('This week')} subtitle={stats ? t('{received} received · {given} udhaar given', { received: inr(stats.week.received), given: inr(stats.week.given) }) : t('Udhaar given vs money received, per day')}>
        {stats ? <WeekColumns days={stats.week.days} /> : <div className="h-36 animate-pulse rounded-lg bg-chip" aria-hidden="true" />}
      </PaytmCard>
    </>
  );
}
