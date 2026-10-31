import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { OwedBars, WeekColumns } from '@/components/Charts';
import { Volume2 } from 'lucide-react';
import { Affordance, PaytmButton, PaytmCard } from '@/components/paytm';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { speak, unlockAudio } from '@/lib/speech';
import type { Stats, Today } from '@/lib/types';
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
  const [today, setToday] = useState<Today | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api.stats().then((s) => { if (alive) { setStats(s); setError(''); } }).catch((e: Error) => { if (alive) setError(e.message); });
    api.today().then((t) => { if (alive) setToday(t); }).catch(() => { /* the card just stays empty */ });
    return () => { alive = false; };
  }, [state]);

  const totals = state?.totals;
  const pendingLine = totals
    ? (totals.total > 0
      ? t(totals.owing_count === 1 ? '{amount} pending · {count} customer' : '{amount} pending · {count} customers', { amount: inr(totals.total), count: totals.owing_count })
      : t('All settled'))
    : '';

  // "Hear it": the end-of-day summary, spoken in the merchant's language (Sarvam voice when available).
  const hear = async () => {
    if (!today) return;
    unlockAudio();
    const audio = await api.tts(today.speak_text, today.lang).then((r) => r.audio_url).catch(() => null);
    speak(today.speak_text, today.lang, audio);
  };

  return (
    <>
      <PaytmCard title={t('Today')} subtitle={today ? (today.payers ? t(today.payers === 1 ? '1 customer paid today' : '{n} customers paid today', { n: today.payers }) : t('No payments yet today')) : t('Udhaar given and money collected today')}
        action={<PaytmButton variant="outline" size="sm" icon={Volume2} disabled={!today} onClick={() => void hear()}>{t('Hear it')}</PaytmButton>}>
        {today ? (
          <div className="grid grid-cols-3 gap-2 text-center">
            {[{ label: 'Udhaar given', value: today.given, cls: 'text-owed' }, { label: 'Collected', value: today.collected, cls: 'text-paid' }, { label: 'Cash sales', value: today.sales, cls: 'text-ink' }].map((tile) => (
              <div key={tile.label} className="rounded-xl bg-chip px-2 py-3">
                <div className={`font-display text-[18px] font-extrabold tabular-nums ${tile.cls}`}>{inr(tile.value)}</div>
                <div className="mt-0.5 text-[11px] text-ink-2">{t(tile.label)}</div>
              </div>
            ))}
          </div>
        ) : <div className="h-16 animate-pulse rounded-lg bg-chip" aria-hidden="true" />}
      </PaytmCard>

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
