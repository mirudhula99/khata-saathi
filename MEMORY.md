# Khata Saathi: project memory

Working notes from the build sessions on 28 to 31 Oct 2026, kept so anyone (or any future Claude session) can pick this up without re-deriving it. Finals: Sat 31 Oct 2026, Paytm office Bengaluru, Track 1 Merchant Growth AI. Team Rupeeriot: Mirudhula (product lead, pitch, UI) and Parthiban (AI and backend).

## What this is

A voice-first udhaar (shop credit) collection assistant for Paytm merchants. Pitch in one line: the ledger is faster than the pen, and it talks back. Five steps: Speak, Confirm, Remind, Collect, Reconcile. Design rule: AI understands, code calculates. Only a verified payment closes udhaar; cash is noted separately.

The USP against Khatabook and Paytm Business Khata: those are typed ledgers with reminders. This is the voice layer that makes the ledger get used, with two-sided entries (customer confirms or flags) and automatic reconciliation on verified payment. Say to Paytm judges: "You own the ledger and the payment rail. We make merchants use it."

## Repo layout (this folder is the git root)

- `app/` FastAPI backend by Parthiban: SQLite ledger in paise (append-only, reversal rows), Sarvam STT/TTS/LLM with rule-based fallback, reminder scheduler with guardrails, mock payment provider with HMAC webhooks, WhatsApp simulator (Cloud API behind a flag), demo clock, join page and QR.
- `web/` React merchant app (Vite, TypeScript, Tailwind v4, shadcn/ui, Zustand, React Router v7, lucide-react). Built into `static/app/` which the backend serves at `/`. The build is committed so a clone runs with no Node.
- `static/` Parthiban's original pages: `/legacy` (one-screen UI), `/customer` (WhatsApp simulator), `/pay/{id}` (mock Paytm page), `/join/{id}`. `backbar.js` adds a "‹ Back" link to them.
- `.superdesign/design-system.md` product intent, copy and money rules. `.superdesign/paytm-pods-spec.md` the Paytm visual spec (tokens, components, screen map) that the React UI follows.
- `docs/SPEAKER_NOTES.md` the finals script, tap by tap.
- `tests/test_fixes.py` Parthiban's backend tests: `python -m unittest discover tests` (20 tests).
- `run-windows.cmd` starts the server on Windows using `.venv-win`.

Not in git by design: `.env` (Sarvam key), `.venv` (Mac), `.venv-win` (Windows), `data/*.db*`, `data/tts_cache/`, `web/node_modules/`.

## Running

Windows: Python 3.12 and ffmpeg via winget, `py -3.12 -m venv .venv-win`, `.venv-win\Scripts\python -m pip install -r requirements.txt`, then `run-windows.cmd` or `.venv-win\Scripts\python.exe -m uvicorn app.main:app --port 8000`. Mac steps are in the README.

Frontend dev: `cd web && npm install && npm run dev` (proxies to :8000). `npm run build` writes `static/app`. `npm run typecheck` must stay at 0 errors.

Keys off for testing without spending credits: `SARVAM_API_KEY= LLM_API_KEY= TTS_ENABLED=false SCHEDULER_ENABLED=false` and a separate `DATABASE_URL=sqlite:///.../data/test.db`. Never test against port 8000 with the real key unless you mean to.

Other devices need the one-time `/?key=<MERCHANT_KEY>` link printed at startup; the laptop itself needs none. Set `MERCHANT_KEY` in `.env` to keep it stable across restarts. Phone mic needs https: `cloudflared tunnel --url http://localhost:8000`, then put the address in `PUBLIC_BASE_URL` and restart.

## Seed data (matches the deck)

Shanthi Stores, 20 customers. 8 owe ₹2,450, four per channel. WhatsApp: Ramesh (Gandhi Street) ₹800 for 40 days, Fatima ₹260, Priya ₹180. Paytm app: Kumaran ₹320, Ravi ₹290 for 12 days, Suresh ₹150 for 5 days. Each of the six has a seeded message history (confirmed udhaar notes, receipts, yesterday's reminder). Lakshmi starts at zero for the hero entry. A second Ramesh (Teacher) exists for the "Which Ramesh?" moment. Seeded debtors have scheduled reminders, so "Move time forward 3 days" sends them. "Who owes me money?" answers: "6 customers owe ₹2,000. Most: Ramesh ₹800 for 40 days, Kumaran ₹320, Ravi ₹290."

## UI decisions that were made deliberately

- Home ("Saathi") opens with the greeting card and the big mic. Quick actions next (Add by hand, Record payment, Customer's phone, Join my khata), then two live charts at the bottom: "Who owes you" bars and "This week" columns (given vs received), fed by `GET /api/stats`.
- Tapping the mic opens a full-screen listening sheet: "Listening…" in the merchant's language, pulsing mic, waveform, and tappable "Try saying" bubbles in that language. ✕ cancels without sending.
- No date on product screens. The demo date shows only in the 10px sandbox caption under the wordmark when the clock is shifted, and in the hidden demo tools.
- Demo tools (Move time forward, Send due reminders, Reset) are hidden behind a long press on the "More" title. Nothing on screen points to them.
- Khata list: chips Pending · Settled · All, 8 rows then "Show N more", search across everyone. Settled rows show name and note only.
- Customer page: settled customers get one quiet "Paid up" line instead of a hero amount; history shows 5 entries then "Show 5 more".
- Reminders page: clean title, an ⓘ icon opens a dark tooltip with the rules, each row shows one line of the actual message with a pen to add the merchant's own line (saved per customer; link and STOP line always kept).
- Notifications (the bell, `/notifications`, `GET /api/notifications`, `app/notifications.py`): derived from the ledger, nothing stored. "Needs you" tasks pinned on top (flagged entry, silent after reminders, can't remind: no WhatsApp / STOP / paused), then events newest first: money in (Paytm verified, cash noted, "settled up"), reminders sent and due, customers joined or added. Filters: All, Needs you, Money in, Reminders, Customers. Bell badge = open tasks + unseen events; "seen" is per device in localStorage. Reminders tab = outbound schedule; bell = inbound alerts.
- Not Splitwise: no split options, no green palette, no friends list as home. Paytm look: sky gradient header, white shadow cards, navy titles, sky-blue pills, 4-column line-icon grids.
- Copy never says overdue, defaulter, debt or split. Buttons are verbs.

## Bugs found by the full functional test (30 Oct) and their status

Fixed: record payment from a customer page could ask "Which Ramesh?"; seeded debtors had no scheduled reminders; "Remind now" ignored Pause and the one-a-day gap; the customer page disabled Flag on every later message after one flag; browser mic could sit silent forever (now times out with "Type instead"); join QR missing in the React app; overpayment via webhook; double-tap Save; paid link reusable; "Next reminder" past-tense wording; English "for N days" inside Tamil and Hindi answers.

Known and accepted for the hackathon: no auth beyond the merchant key link; WhatsApp and Paytm are simulated unless configured; the Paytm provider adapter is a stub; LLM failures fall back to rules silently (the More tab used to show which is active; check `parsed.source` in API responses).

## Honest phrasing for judges

WhatsApp is a simulator with the Cloud API wired behind a flag. Payments are a mock provider whose signed webhook goes through the same verification, de-duplication and ledger code a real Paytm callback would. Everything else, the ledger, confirm-before-save, disputes, reminder guardrails, reconciliation, five-language replies, is real.

## Languages (whole app follows the merchant language set under More → "I speak, Saathi replies in"; the home mic card no longer has its own dropdown)

- Frontend: `web/src/lib/i18n.ts` (`useT()` in components, `tNow()` in the store) looks each English string up in the merchant's language; English is the fallback. Dictionaries per area in `web/src/i18n/{shared,saathi,khata,more}.ts`, keys = the exact English strings, placeholders `{name}`. Hindi, Kannada, Tamil, Telugu.
- Backend: `app/i18n.py` has MERCHANT (Saathi replies), CUSTOMER (WhatsApp messages) and NOTIF (bell items) tables in all five languages; `notifications.build(db, merchant_id, lang)`. `FlowError` texts stay English.
- Demo rule: in DEMO_MODE, changing the merchant language also sets every customer's language (`services.sync_demo_languages`), so reminders and the customer phone flip with the dropdown. In production each customer keeps the language they chose when joining.
- Plain pages (`static/customer.js`, `pay.html`, `join.html`, `paytm.js`) carry their own small dictionaries keyed by the customer's (or shop's) language.

## Customer channels (WhatsApp or the Paytm app)

- `Customer.channel` = `whatsapp` (default) or `paytm`; editable on the customer page ("Reminders via"), shown as a small mark on Khata and Reminders rows. Seed (31 Oct): eight debtors, four per channel. WhatsApp: Ramesh (Gandhi Street) ₹800/40d, Fatima ₹260, Meena ₹220, Priya ₹180. Paytm app: Kumaran ₹320, Ravi ₹290, Ganesh ₹230, Suresh ₹150. Total ₹2,450. All eight have seeded message history; Lakshmi stays empty for the live entry.
- Paytm-channel messages are stored with `channel="paytm"`, status delivered, and never go to the WhatsApp API. The mock Paytm app is `static/paytm.html` + `paytm.js` at `/paytm?id=<customer>`: notifications list (Pay, Amount wrong?), a reminders switch (STOP/START), and a Paytm-style payment sheet that posts to the same `/api/pay/{link}/simulate` mock webhook as the WhatsApp pay page.
- The phone icon on a row opens `/customer?id=` for WhatsApp customers and `/paytm?id=` for Paytm ones.
- Translations are agent-written drafts; have a native speaker read Tamil and Kannada before showing them to a judge who speaks them.

## Conventions

- Commits: plain messages, author `mirudhula99 <mirudhula99@users.noreply.github.com>` on this machine, no AI co-author lines.
- Parthiban works on `dev/parthi`; merge into `main` with `git pull origin dev/parthi` then `git push`.
- Keep `.env` out of every zip and every commit.
- After any backend change, restart the server; the Windows start command has no `--reload`.
