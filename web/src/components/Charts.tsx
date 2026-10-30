import { useState, type PointerEvent, type ReactNode } from 'react';
import { cn, inr } from '@/lib/utils';

/**
 * Two small charts for the Saathi home, drawn by hand (no chart library) so the demo stays offline.
 * Rules followed (dataviz skill): marks <= 24px thick with a 4px rounded data-end, hairline grid, text in ink tokens
 * (never the series colour), a legend for two series, direct labels only on the extremes, a per-mark hover tooltip,
 * and a table view so every number is reachable without hovering.
 * Palette validated with the skill's validator on the white surface: #1C5FD6 (money received / Paytm blue) and
 * #F79009 (udhaar given, the pending amber). The amber's contrast warning is relieved by the labels and the table.
 */
const BLUE = '#1C5FD6';
const AMBER = '#F79009';

type Tip = { x: number; y: number; body: ReactNode } | null;

function Tooltip({ tip }: { tip: Tip }) {
  if (!tip) return null;
  return (
    <div role="status" className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-ink px-2.5 py-1.5 text-[12px] text-white shadow-card"
      style={{ left: tip.x, top: tip.y - 8 }}>
      {tip.body}
    </div>
  );
}

/** Horizontal bars: who owes how much. Single series, so no legend; the card title names it. */
export function OwedBars({ rows }: { rows: { name: string; balance: number; days: number }[] }) {
  const [tip, setTip] = useState<Tip>(null);
  const [table, setTable] = useState(false);
  const top = rows.slice(0, 5);
  const max = Math.max(1, ...top.map((r) => r.balance));
  if (top.length === 0) return <p className="text-[13px] text-ink-2">Nobody owes you right now.</p>;
  return (
    <div className="relative">
      <Tooltip tip={tip} />
      {table ? (
        <table className="w-full text-[13px]">
          <thead><tr className="text-left text-[11px] uppercase tracking-wider text-ink-2"><th className="py-1 font-semibold">Customer</th><th className="py-1 text-right font-semibold">Pending</th><th className="py-1 text-right font-semibold">Days</th></tr></thead>
          <tbody>{top.map((r) => <tr key={r.name + r.days} className="border-t border-line"><td className="py-1.5">{r.name}</td><td className="py-1.5 text-right tabular-nums">{inr(r.balance)}</td><td className="py-1.5 text-right tabular-nums">{r.days}</td></tr>)}</tbody>
        </table>
      ) : (
        <div className="flex flex-col gap-2.5">
          {top.map((r) => (
            <div key={r.name + r.days} className="grid grid-cols-[72px_1fr_auto] items-center gap-2">
              <div className="min-w-0"><div className="truncate text-[13px] font-medium text-ink">{r.name}</div><div className="text-[11px] text-ink-2">{r.days} days</div></div>
              <div className="h-4 rounded-r bg-chip" aria-hidden="true">
                <button type="button" tabIndex={0} aria-label={`${r.name} owes ${inr(r.balance)}, pending ${r.days} days`}
                  className="block h-4 min-w-1 rounded-r hover:brightness-110 focus-visible:outline-2 focus-visible:outline-sky"
                  style={{ width: `${(r.balance / max) * 100}%`, background: BLUE }}
                  onPointerEnter={(e) => { const b = (e.currentTarget.parentElement?.parentElement as HTMLElement).getBoundingClientRect(); const p = (e.currentTarget.closest('.relative') as HTMLElement).getBoundingClientRect(); setTip({ x: e.clientX - p.left, y: b.top - p.top, body: <><b>{inr(r.balance)}</b> · {r.name} · {r.days} days</> }); }}
                  onPointerLeave={() => setTip(null)} />
              </div>
              <div className="text-right text-[13px] font-semibold tabular-nums text-ink">{inr(r.balance)}</div>
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={() => setTable((t) => !t)} className="mt-2 text-[12px] font-semibold text-sky-ink">{table ? 'Show bars' : 'Show table'}</button>
    </div>
  );
}

/** Grouped columns: udhaar given vs money received, per day for the last 7 days. Two series, so a legend. */
export function WeekColumns({ days }: { days: { date: string; label: string; given: number; received: number }[] }) {
  const [tip, setTip] = useState<Tip>(null);
  const [table, setTable] = useState(false);
  const W = 340, H = 150, padL = 34, padR = 6, padT = 14, padB = 22;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const max = Math.max(...days.flatMap((d) => [d.given, d.received]), 0);
  const step = max <= 0 ? 100 : max <= 500 ? 100 : max <= 2000 ? 500 : max <= 5000 ? 1000 : 2000;
  const yMax = Math.max(step, Math.ceil(max / step) * step);
  const ticks = [0, yMax / 2, yMax];
  const y = (v: number) => padT + innerH - (v / yMax) * innerH;
  const group = innerW / Math.max(1, days.length);
  const bar = Math.min(14, (group - 10) / 2);
  const compact = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v % 1000 ? 1 : 0)}K` : String(v));
  const quiet = days.every((d) => d.given === 0 && d.received === 0);
  const lastGiven = [...days].reverse().find((d) => d.given > 0);
  const lastReceived = [...days].reverse().find((d) => d.received > 0);

  const show = (e: PointerEvent<SVGElement>, d: (typeof days)[number]) => {
    const host = (e.currentTarget.closest('.relative') as HTMLElement).getBoundingClientRect();
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ x: r.left + r.width / 2 - host.left, y: r.top - host.top, body: <><b>{inr(d.received)}</b> received · <b>{inr(d.given)}</b> given<br /><span className="opacity-80">{d.label} {d.date.slice(8)}/{d.date.slice(5, 7)}</span></> });
  };

  return (
    <div className="relative">
      <Tooltip tip={tip} />
      {/* Legend: always present for two series; text in ink tokens, the swatch carries the colour. */}
      <div className="mb-1 flex items-center gap-4 text-[12px] text-ink-2">
        <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-sm" style={{ background: AMBER }} aria-hidden="true" /> Udhaar given</span>
        <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-sm" style={{ background: BLUE }} aria-hidden="true" /> Money received</span>
      </div>
      {table ? (
        <table className="w-full text-[13px]">
          <thead><tr className="text-left text-[11px] uppercase tracking-wider text-ink-2"><th className="py-1 font-semibold">Day</th><th className="py-1 text-right font-semibold">Given</th><th className="py-1 text-right font-semibold">Received</th></tr></thead>
          <tbody>{days.map((d) => <tr key={d.date} className="border-t border-line"><td className="py-1.5">{d.label} {d.date.slice(8)}/{d.date.slice(5, 7)}</td><td className="py-1.5 text-right tabular-nums">{inr(d.given)}</td><td className="py-1.5 text-right tabular-nums">{inr(d.received)}</td></tr>)}</tbody>
        </table>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Udhaar given and money received per day, last 7 days" className="block overflow-visible">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--p-line)" strokeWidth={1} />
              <text x={padL - 6} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill="var(--p-ink-3)" style={{ fontVariantNumeric: 'tabular-nums' }}>{compact(t)}</text>
            </g>
          ))}
          {days.map((d, i) => {
            const gx = padL + i * group + group / 2;
            const xg = gx - bar - 1, xr = gx + 1;
            const hG = Math.max(0, y(0) - y(d.given)), hR = Math.max(0, y(0) - y(d.received));
            const r = 4;
            const col = (x: number, h: number, fill: string) => h <= 0 ? null : (
              <path d={`M${x},${y(0)} v${-(Math.max(0, h - r))} a${r},${r} 0 0 1 ${r},${-r} h${bar - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${Math.max(0, h - r)} z`} fill={fill} />
            );
            return (
              <g key={d.date} tabIndex={0} aria-label={`${d.label}: ${inr(d.given)} given, ${inr(d.received)} received`} className="cursor-default outline-none hover:brightness-110 focus-visible:[&>rect]:stroke-sky"
                onPointerEnter={(e) => show(e, d)} onPointerMove={(e) => show(e, d)} onPointerLeave={() => setTip(null)}>
                <rect x={gx - group / 2} y={padT} width={group} height={innerH} fill="transparent" />
                {col(xg, hG, AMBER)}
                {col(xr, hR, BLUE)}
                {/* Direct labels only on the latest non-zero value of each series. */}
                {lastGiven?.date === d.date && <text x={xg + bar / 2} y={y(d.given) - 4} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--p-ink)">{compact(d.given)}</text>}
                {lastReceived?.date === d.date && <text x={xr + bar / 2} y={y(d.received) - 4} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--p-ink)">{compact(d.received)}</text>}
                <text x={gx} y={H - 6} textAnchor="middle" fontSize={10} fill={i === days.length - 1 ? 'var(--p-ink)' : 'var(--p-ink-2)'} fontWeight={i === days.length - 1 ? 600 : 400}>{i === days.length - 1 ? 'Today' : d.label}</text>
              </g>
            );
          })}
        </svg>
      )}
      <div className={cn('mt-1 flex items-center justify-between text-[12px]', quiet ? 'text-ink-2' : 'text-ink-2')}>
        <span>{quiet ? 'No activity yet this week.' : ''}</span>
        <button type="button" onClick={() => setTable((t) => !t)} className="font-semibold text-sky-ink">{table ? 'Show chart' : 'Show table'}</button>
      </div>
    </div>
  );
}
