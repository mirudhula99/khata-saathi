# Khata Saathi design system

Format follows superdesign's `design-system.md` convention (product context, tokens, motion, components). Read this before designing or changing any screen. Reference: `tools/superdesign-skill/DESIGN.md`.

## 1. Product context

**What it is.** A voice-first udhaar (shop credit) collection assistant for Paytm merchants, shipped as a feature inside Paytm for Business. The merchant speaks an entry, Saathi reads it back, the customer confirms on WhatsApp, polite reminders go out on the merchant's schedule, and a verified Paytm payment closes the entry.

**Who it is for.** A kirana owner at a busy counter, 35 to 55, phone in one hand, often in Tamil, Kannada, Hindi or Telugu. Hands busy, shop noisy, no patience for forms. They already talk to a Paytm Soundbox every day.

**Core value in one line.** The ledger is faster than the pen, and it talks back.

**Design intent (what the UI must communicate at a glance).**
1. **Voice is the product.** The mic and the Saathi reply are the hero of the home screen. Not a balance card, not a list. Speak first, see the ledger second.
2. **Trust before speed.** Every entry shows a read-back before it saves. Every amount shows who confirmed it. Verified Paytm payments look different from cash notes.
3. **Dignity.** Reminders read as polite messages from the shop, not as collection notices. Overdue is shown as "40 days" in warm amber, never red, never "defaulter".
4. **Paytm-native.** Looks like it belongs inside Paytm for Business: navy header, white cards, sky-blue action, ₹ typography. Not iOS-generic, not Splitwise-green.

**Key journeys.**
- Speak an entry → read-back card → Save → customer confirms on WhatsApp.
- Ask "Who owes me money?" → spoken answer with the top debtor → Remind.
- Record a payment → live "₹x of ₹y, ₹z left" → Paytm link or cash note.
- Day ticks → scheduler sends reminders within guardrails → customer pays → balance reconciles.

**Not Splitwise.** Splitwise is peer-to-peer expense splitting among friends. Khata Saathi is one-way shop credit. Do not copy its green palette, its "Friends" list as the home screen, its "split" vocabulary, or its avatar-row visual rhythm as the primary pattern.

## 2. Design tokens

### Colour (Paytm language)

| Token | Light | Use |
|---|---|---|
| `--navy` | `#002E6E` | Header band, primary text on light, primary buttons |
| `--navy-deep` | `#001F4D` | Header gradient end, pressed primary |
| `--sky` | `#00BAF2` | The one accent: mic, active tab, links, progress, chips |
| `--sky-ink` | `#0A7FB0` | Sky used as text on white (contrast-safe) |
| `--sky-tint` | `#E6F7FE` | Selected rows, chip backgrounds, info cards |
| `--bg` | `#F4F7FB` | Page background, cool white with a navy bias |
| `--card` | `#FFFFFF` | Cards, sheets, list groups |
| `--ink` | `#0B1A33` | Body text |
| `--ink-2` | `#5B6B85` | Secondary text, labels |
| `--line` | `#E1E7F0` | Hairlines, dividers |
| `--rupee-owed` | `#D97706` | Amount owed to the merchant (amber, warm, not alarming) |
| `--rupee-paid` | `#0F9D58` | Verified Paytm payment, settled |
| `--cash` | `#7C6F64` | Cash note (muted brown: "noted, not verified") |
| `--flag` | `#C2410C` | Flagged / disputed entry (burnt orange, used sparingly) |
| `--wa` | `#DCF8C6` / `#ECE5DD` | WhatsApp bubbles and background, only on the customer screen |

Rules: sky is the only accent; never introduce a second bright hue. Semantic money colours (amber, green, brown, burnt orange) are not accents and never used for decoration. No gradients except the header band (navy → navy-deep, vertical, subtle).

Dark mode: not required for the demo. If implemented, keep the navy header and swap surfaces to `#0B1529` / `#122040` with `--ink` `#E8EEFB`.

### Typography

- **Display and headings:** Manrope (bundled via `@fontsource-variable/manrope`, so the demo works offline). Weight 700 to 800, tight letter-spacing (-0.02em). Used for the large title, the ₹ amounts and the Saathi reply.
- **Body and UI:** system stack (`-apple-system, "Segoe UI", Roboto, system-ui, sans-serif`). Weight 400 to 600.
- **Numbers:** always `font-variant-numeric: tabular-nums`. Rupee amounts use Indian grouping (₹1,24,000) via `toLocaleString('en-IN')`.

Scale: 34 large title · 22 section title · 28 to 36 hero amount · 17 body large · 15 body · 13 secondary · 11 uppercase label (letter-spacing 0.06em).

### Spacing, radius, elevation

- 4-point grid. Page gutter 16. Card padding 16. Row height 56 (touch targets never under 44).
- Radius: cards 16, buttons 12, chips 999, mic 999, sheets 24 top corners.
- Elevation: cards have no shadow on the grey page, only a hairline. The mic has a sky glow (`0 10px 28px rgba(0,186,242,.40)`). Sheets have `0 -8px 32px rgba(0,31,77,.18)`.

## 3. Motion

- Mic listening: a soft sky ring pulsing outwards every 1s, plus a 5-bar waveform animating under the mic. Respect `prefers-reduced-motion`.
- Saathi reply: fades up 160ms with a slight translateY(8px). While speech synthesis is speaking, the Saathi card shows a thin animated sky bar at its top edge.
- Sheets slide up 280ms with `cubic-bezier(.2,.8,.2,1)`.
- Balance changes: the amount cross-fades (no counting animation; this is money).
- Tabs: no animation. Buttons: `active:scale-[0.98]`.

## 4. Components

**Header band.** Navy gradient, white large title in Manrope, a one-line subtitle in sky-tint at 85% opacity. Appears on the Saathi (home) and Khata screens. Modal sheets use a white compact header with "✕ Title Save".

**Mic hero.** 96px sky circle with white mic icon, centred, label under it in navy: "Speak an entry, or ask". Below it a row of suggestion chips in the chosen language (native script where possible: "லட்சுமிக்கு 150 கடன், 2 கிலோ அரிசி" plus Latin transliteration as the secondary line). A text field "or type it" under the chips. Language chips: த · ಕ · हि · తె · En.

**Saathi reply card.** White card, left edge 3px sky, small label "SAATHI" in 11px uppercase sky-ink, the reply in Manrope 17, and an action row (Save / Correct / Cancel, or Remind / Later). This is the read-back component and the answer component; same shape everywhere.

**Udhaar summary strip.** Under the mic on the home screen: one line, two numbers, no card chrome. "₹1,240 pending · 3 customers" with a small "Collected via Paytm this week ₹500" in green. Tapping goes to Khata.

**Customer row.** 56px. Left: a navy circle with the first letter (Manrope, white). Middle: name in 15/600, under it the latest item in 13 ink-2. Right: amount in Manrope 17 amber (owed) or green "Settled"; under it "40 days" in 13. A tiny sky dot when the customer has a pending confirmation. No chevrons; the whole row is tappable.

**Status chips.** Pill, 11px uppercase: "Awaiting confirm" (sky-tint), "Flagged" (flag colour on 10% tint), "Reminded today" (ink-2 on line), "Paused" (amber tint), "Opted out" (ink-2).

**Payment line.** In history: "₹300 · Paytm · verified ✓" in green, "₹200 · cash · noted" in cash brown with a dashed left border. The difference must be visible without reading.

**Settle-up sheet.** Big ₹ input in Manrope 36, live footer "₹300 of ₹800 · ₹500 left", segmented control Paytm link | Cash. Primary button navy "Send Paytm link" or "Note cash".

**Reminder card.** Shows the actual message text the customer will get, in a WhatsApp-style bubble, with the schedule ("every 3 days"), the guardrail state, and Pause / Opt-out as quiet text buttons. Never a red "overdue" banner.

**Tab bar.** Four tabs, white, hairline top: Saathi (mic icon, home) · Khata (book) · Reminders (bell) · More (grid). Active tab sky, inactive ink-2. No floating centre button: the mic is the home screen, not a shortcut.

**Day chip.** "Day 3 · 2 Nov" in the header, ink on sky-tint pill, with a ▶ "Next day" control only on the Reminders screen.

**Customer WhatsApp screen.** The only place the WhatsApp green appears. Bubbles from the shop on the left (white), customer replies on the right (wa green). Entry bubbles carry Confirm / Flag as inline links. Reminder bubbles carry "Pay via Paytm" as a navy button.

**Paytm sandbox pay page.** White, Paytm navy wordmark text "Paytm · Sandbox", merchant name, ₹ amount in Manrope 36, buttons "Pay ₹800" (navy) and "Pay part" (outline). After paying, a green verified card with the order id.

## 5. Copy and tone

- Saathi speaks in short, warm sentences. "Lakshmi, ₹150 for rice. Save entry?" "3 customers owe ₹1,240. Ramesh owes ₹800 for 40 days. Shall I remind him?"
- Buttons are verbs: Save, Remind, Send Paytm link, Note cash, Next day.
- Never: defaulter, overdue, debt, collect (as a label), split. Use: pending, udhaar, reminder, received, settled.
- Numbers: ₹ with Indian grouping; days as "40 days" (and "40 நாள்" when the UI language is Tamil, later).
