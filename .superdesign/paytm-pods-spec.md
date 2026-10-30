# Paytm look for Khata Saathi (PODS-derived spec)

Source: Paytm app screenshots and the PODS (Paytm Official Design System) overview in
`design-reference/paytm/*.png` (see `Under-Paytms-Design-Hood-_01`, `_02`, `Personal-Dashboard-1`, `PODS_02`, `Whats-Under-the-Hood_`).
This spec OVERRIDES the visual parts of `design-system.md`. Product intent, copy rules and money semantics in
`design-system.md` still apply. Functionality never changes: every button, route, API call and state stays.

## 1. The look in one paragraph

A pale sky-blue page that fades to near-white, with white cards floating on it. Cards have generous 16px radius,
a soft blue-tinted shadow, a bold dark title at top-left, a one-line grey subtitle, and a light-grey "Recent ›"
style affordance at top-right. Inside cards, actions are a 4-column grid of thin navy line-icons with 11px
two-line labels. Buttons are sky-blue pills with white text. Accents are one blue family; semantic colours
appear only inside pastel alert strips. Nothing is heavy: no dark header bands, no solid navy blocks, no borders
around cards (shadow instead), hairlines only inside lists.

## 2. Tokens

| Token | Value | Use |
|---|---|---|
| `--p-sky-50` | `#EAF6FD` | Page background top (header area) |
| `--p-sky-100` | `#D6EEFB` | Header gradient start |
| `--p-page` | `#F3F7FB` | Page background below the header |
| `--p-card` | `#FFFFFF` | Cards, sheets, tab bar |
| `--p-blue` | `#002E6E` | Primary ink for titles and the wordmark's dark half, icon strokes |
| `--p-blue-600` | `#1C5FD6` | Icon accent strokes, links on white |
| `--p-sky` | `#00BAF2` | Primary buttons, active tab, mic, the wordmark's light half |
| `--p-sky-ink` | `#0A7FB0` | Sky as text on white |
| `--p-sky-tint` | `#E6F7FE` | Selected chip, info strip |
| `--p-ink` | `#101828` | Body text (near-black, not navy) |
| `--p-ink-2` | `#667085` | Subtitles, labels, "Recent" |
| `--p-ink-3` | `#98A2B3` | Placeholders, disabled |
| `--p-line` | `#EAECF0` | Hairlines inside lists |
| `--p-chip` | `#F2F4F7` | Grey pill chips (like the UPI ID chip) |
| `--p-success` | `#12B76A` on `#ECFDF3` | Verified payment, settled |
| `--p-warning` | `#F79009` on `#FFFAEB` | Pending amounts, paused |
| `--p-error` | `#F04438` on `#FEF3F2` | Flagged, errors |
| `--p-info` | `#1C5FD6` on `#EFF6FF` | Tips, read-back hints |
| `--p-shadow` | `0 2px 12px rgba(0, 46, 110, 0.08)` | Every card |
| `--p-shadow-lg` | `0 8px 28px rgba(0, 46, 110, 0.14)` | Sheets, floating mic |
| radius | card 16, button 999 (pill), input 12, chip 999, sheet top 24 | |
| spacing | page gutter 16, card padding 16, grid gap 12, card gap 12, icon tile 48 | |

Header gradient: `linear-gradient(180deg, var(--p-sky-100) 0%, var(--p-sky-50) 60%, var(--p-page) 100%)` behind
the top ~160px of every top-level screen; the rest of the page is `--p-page`.

Dark mode: not required for the demo. Keep tokens on `:root`; a `.dark` block may map to deep navy surfaces but is optional.

## 3. Typography

- Display and card titles: Manrope (bundled), 700 to 800. Card title 16/700 `--p-blue`; screen title 22/800.
- Body: system stack. Body 15/400 `--p-ink`; secondary 13/400 `--p-ink-2`; grid labels 11/500 `--p-ink` with `line-height: 1.2`, max two lines, centred.
- Money: Manrope, tabular-nums, Indian grouping. Hero amount 32/800; row amount 15/700.
- "Recent ›" affordance: 13/500 `--p-ink-3` with a 14px chevron.

## 4. Components (recipes; each page must use these, not ad-hoc styles)

**Top bar** (every top-level screen): 56px, on the sky gradient. Left: 32px round avatar with the shop initial on `--p-blue`.
Centre: the screen's wordmark-style title: "Khata **Saathi**" with "Khata" in `--p-blue` 800 and "Saathi" in `--p-sky` 800
(mirrors pay|tm). Right: two 24px line icons (`Search`, `Bell` or `MessageCircle`) in `--p-blue`. No large dark header band anywhere.

**Greeting line** (Saathi home only, under the top bar): 13/500 `--p-ink-2`: "Vanakkam, Shanthi Stores · Fri 30 Oct".

**Card** (`PaytmCard`): white, radius 16, `--p-shadow`, padding 16, no border. Header row: title (16/700 `--p-blue`) + optional
subtitle under it (12 `--p-ink-2`) on the left; optional right affordance ("Recent ›", "Open ›", a chip). Content below with 12px gap.
Cards stack with 12px gaps inside the 16px gutter.

**Icon grid tile** (`IconTile`): 4 per row (`grid-cols-4`), each a column: 48px square area with a 28px Lucide icon at
`strokeWidth 1.6` in `--p-blue` (an accent dot or second stroke may use `--p-sky`), then an 11px two-line centred label.
Tap target = the whole tile, `active:opacity-70`. No background on the tile.

**Pill button** (`PaytmButton`): height 44 (36 for small), radius 999, `--p-sky` background, white 15/700 label, `active:scale-[0.98]`.
Variants: `primary` (sky), `dark` (`--p-blue` background, white text; use for destructive-free emphasis like "Save"),
`outline` (white, 1px `--p-blue-600` border, blue text), `ghost` (text only, `--p-blue-600`). All with Lucide icon optional at 18px.

**Chip** (`PaytmChip`): `--p-chip` background, radius 999, 12/500 `--p-ink-2`, height 28, optional 14px leading icon. Selected = `--p-sky-tint` + `--p-sky-ink`.

**List row** (`PaytmRow`): 56px min, 16px horizontal padding, hairline `--p-line` between rows (not after the last), left avatar 40px round
(`--p-sky-tint` background, `--p-blue` initial), title 15/600 `--p-ink`, sub 13 `--p-ink-2`, right slot (amount 15/700 + 12px status under it),
chevron 16px `--p-ink-3`. Rows live inside a Card with zero padding.

**Alert strip** (`PaytmAlert`): radius 12, pastel background + 4px left bar in the semantic colour, title 14/600 + text 13. Used for
read-back hints, errors, "demo sandbox" notice, reminder previews.

**Promo / summary banner**: the ₹ pending summary becomes a pastel gradient card (`linear-gradient(90deg, #FDE7F3, #E9E4FF 50%, #D6EEFB)`)
like Paytm's cashback banner: "₹1,240 pending" in 22/800 `--p-blue`, "3 customers · Open khata →" under it, small `--p-blue` pill "Open khata".

**Mic hero**: 128px sky circle, white mic icon 64px, `--p-shadow-lg` plus sky glow, centred inside a white Card titled "Speak to Saathi"
(subtitle "Udhaar, payments, or a question"). Under the mic: status text 17/700 `--p-blue`. The "I speak in" row is a Chip-style select
inside the same card header's right slot. "Try saying" rows are PaytmRows (no icons, chevron right) inside a second Card titled "Try saying"
with "More ›" as the affordance. The "or type it" input is a 44px `--p-chip` pill with a sky send button, at the bottom of the mic card.

**Tab bar**: white, `--p-shadow` upwards, 4 items, 24px line icons, 11px labels; active = `--p-sky` icon and label, inactive `--p-ink-2`.

**Sheets and dialogs**: white, top radius 24, `--p-shadow-lg`, a 36×4 grey grabber, title 18/800 `--p-blue`, primary action as a full-width pill.

**Inputs**: 48px, radius 12, white with 1px `--p-line`, focus ring `--p-sky`. Amount input: Manrope 32/800 with a leading ₹ in `--p-ink-2`.

**Status badges**: tiny pills (11/600): awaiting confirm = sky-tint/sky-ink; flagged = error pastel; paused = warning pastel; settled = success pastel; cash noted = `--p-chip`/`--p-ink-2`.

## 5. Screen-by-screen mapping (keep every function)

- **Saathi (/)**: top bar + greeting line → Card "Speak to Saathi" (language chip-select at top-right, mic, status, type-it pill) → pending/read-back card as a PaytmAlert(info) with the Save / Correct / Cancel pills → Card "Try saying" (rows) → promo-style pending summary banner → a 4-tile grid Card "Quick actions": Add by hand, Customer's phone, Reminders, Khata.
- **Khata (/khata)**: top bar → Card with title "Who owes you", subtitle "₹1,240 pending · 3 customers", affordance = search icon → rows (pending first) → second Card "Settled" with rows. Search field as a chip-pill input under the title when active.
- **Customer (/khata/:id)**: top bar (compact, back chevron left, name as title) → Card: big amount (Manrope 32/800, warning colour if pending, success "Settled" if zero), "pending 40 days" chip, then a 4-tile grid: Remind, Record payment, Customer's phone, Pause/Resume → Card "History" with rows (verified green vs cash-noted grey) → consent / opt-out as a chip row.
- **Record payment (/khata/:id/settle)**: sheet-style page: amount input, live "₹x of ₹y · ₹z left" as a PaytmAlert(info), segmented chips Paytm link | Cash, full-width primary pill.
- **Reminders (/reminders)**: top bar → Card "Demo clock" (date, "+3 days" pill, "Run reminders now" outline) → Card "Reminder queue" with rows per customer (schedule, paused/opted-out badges, message preview as a PaytmAlert(info) when expanded).
- **More (/account)**: top bar → Card "Shop" (name, language select) → Card "System" with 4-tile grid of status (Voice, LLM, Speech out, Messaging) using success/ink-3 icon colours → Card "Demo" with Reset (outline pill), Customer phone, Join QR, Legacy UI as rows.

## 6. Don'ts

No dark navy header bands. No borders on cards. No horizontal scrolling rows. No emoji. No second accent hue. No Splitwise green.
No changing any API call, route, prop name or store action. No removing the demo banner (restyle it as a PaytmAlert(info) strip).
