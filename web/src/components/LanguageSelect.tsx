import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LANGS } from '@/lib/speech';
import type { LangCode } from '@/lib/types';
import { useKhata } from '@/store/useKhata';

/** The merchant's language: what they speak and what Saathi replies in (PATCH /api/merchant). Chip-style select (spec section 4 Chip, selected state: sky-tint, sky-ink 12/500).
 * The chevron override repeats the base trigger's `svg:not([class*='text-'])` selector: a plain `[&_svg]:` rule loses to it on specificity. */
export function LanguageSelect({ id = 'lang' }: { id?: string }) {
  const { lang, setLang } = useKhata();
  return (
    <Select value={lang} onValueChange={(v) => void setLang(v as LangCode)}>
      <SelectTrigger id={id} size="sm" className="font-sans h-8 gap-1.5 bg-sky-tint px-3 text-[12px] font-medium tracking-normal text-sky-ink shadow-none [&_svg:not([class*='text-'])]:text-sky-ink [&_svg]:opacity-70"><SelectValue /></SelectTrigger>
      <SelectContent align="end">{LANGS.map((l) => <SelectItem key={l.code} value={l.code}>{l.native} · {l.label}</SelectItem>)}</SelectContent>
    </Select>
  );
}
