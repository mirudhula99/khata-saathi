# Khata Saathi merchant app (React) on the FastAPI backend

The Paytm-themed merchant app (Vite + React + TypeScript + Tailwind v4 + shadcn/ui + Zustand + React Router + lucide-react) running on `app/main.py`. Design spec: `../.superdesign/design-system.md`.

The original one-screen UI is untouched (`../static/index.html`) and still served at **/legacy**. The customer phone (`/customer`), the pay page (`/pay/<id>`) and the join page (`/join/1`) are his pages and are used as-is.

## Run

**Demo (one process):** build once, then start the server as usual.

```powershell
cd web
npm install          # first time only
npm run build        # writes ../static/app
cd ..
.\run-windows.cmd    # or: .\.venv-win\Scripts\python.exe -m uvicorn app.main:app --port 8000
```

Open http://localhost:8000. Voice needs https on a phone: `cloudflared tunnel --url http://localhost:8000`, then put the printed address in `.env` as `PUBLIC_BASE_URL` and restart (payment links and the join QR use it).

**Development (hot reload):** his server on :8000 in one window, Vite in another.

```powershell
npm run dev          # http://localhost:5173, proxies /api, /static, /customer, /pay, /join ... to :8000
```

`npm run typecheck` runs strict TypeScript. The build output in `static/app` is what the server serves.

## Screens → endpoints

| Screen (route) | What it does | Endpoints |
|---|---|---|
| Saathi `/` and `/add` | Mic hero, language chips, suggestion chips, "or type it". Read-back card with Save / Change amount / Cancel. "Which Ramesh?" dialog. "Add by hand" sheet. | `POST /api/voice` (MediaRecorder clip, when `health.voice && health.ffmpeg`) or Web Speech → `POST /api/command`; `POST /api/actions/{id}/confirm`, `/correct`, `/reject`, `/choose`, `/new-customer`; `PATCH /api/merchant` (language) |
| Khata `/khata` | Pending and paid-up customers, search, add customer | `GET /api/state` |
| Customer `/khata/:id` | Balance, repayment habit, flagged entries (Keep / Remove), Record payment, Remind now, Add udhaar, consent / pause / language / phone, the full record | `GET /api/customers/{id}`, `PATCH /api/customers/{id}`, `POST /api/customers/{id}/remind`, `POST /api/entries/{id}/resolve` |
| Record payment `/khata/:id/settle` | Big ₹ input, "₹x of ₹y · ₹z left", Payment link or Cash. Sends the sentence through the same read-back path. | `POST /api/command` ("Ask Kumaran for 500" / "Kumaran paid 300 cash") then `/api/actions/{id}/confirm` |
| Reminders `/reminders` | Demo clock, Move time forward 3 days, Run now, who gets reminded and why, message preview, Remind now, Pause | `GET /api/state`, `POST /api/demo/fast-forward`, `POST /api/demo/run-reminders`, `POST /api/customers/{id}/remind`, `PATCH /api/customers/{id}` |
| More `/account` | Language, what is on (Sarvam / LLM / TTS / ffmpeg / messaging / payments), links to the customer phone, join page and `/legacy`, Reset demo | `GET /api/health` (via state), `PATCH /api/merchant`, `POST /api/demo/reset` |
| Live updates | Toasts and spoken alerts for payments, disputes, joins, reminders; state refresh | `GET /api/events?channel=merchant:<id>` (SSE), `GET /api/tts` |

Spoken replies: `reply_audio_url` (Sarvam, cached on disk) is played when present, else the browser voice speaks `speak_text`.

"Add by hand" and "Record payment" do not write to the ledger directly. They compose the sentence the merchant would have said and send it to `/api/command`, so every entry still goes understand → read-back → yes.

## What changed in `app/main.py`

Three small additions, all marked with comments:

1. `GET /` serves `static/app/index.html` when it exists, otherwise the original `static/index.html`.
2. `GET /legacy` always serves the original UI.
3. A final catch-all `GET /{path}` serves the React index for client-side routes (`/khata`, `/khata/3`, `/reminders`, `/account`). It is registered last and refuses anything under `api/`, `static/`, `audio/`, `webhooks/`, `customer`, `pay/`, `join/`, the manifest, `sw.js`, `legacy`, or any path with a file extension, so nothing of his is shadowed.

No API behaviour changed. `static/sw.js` caches nothing, so the old service worker does not interfere; the React app registers no service worker.

## Revert to the original UI

Delete `static/app` (then `/` serves `static/index.html` again), or just open `/legacy`. Removing the three blocks from `app/main.py` restores the file exactly.

## Without a Sarvam key

The mic falls back to the browser's Web Speech API (Chrome / Edge) and the server uses its rule-based parser. The suggestion chips only use sentences that parser handles: the Lakshmi entry, "Who owes me money?", "Ramesh paid 300 cash" (two Rameshes → which one?), "How much does Kumaran owe?", "Ask Kumaran for 500". With the key, Sarvam speech-to-text and the LLM take over automatically and ffmpeg must be on the PATH (open a new terminal after installing it).
