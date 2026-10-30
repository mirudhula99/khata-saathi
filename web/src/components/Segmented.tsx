import { cn } from '@/lib/utils';

/** Segmented control on the grey page: selected segment is white with navy text. */
export function Segmented<T extends string>({ value, onChange, options, className, id }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string; id?: string }) {
  return (
    <div id={id} role="tablist" className={cn('grid rounded-xl border border-line bg-muted p-0.5', className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('h-9 rounded-[10px] px-2 text-[13px] font-semibold transition-colors active:scale-[0.98]', value === o.value ? 'bg-card text-navy shadow-[0_1px_2px_rgba(0,31,77,0.12)]' : 'text-ink-2')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
