# Khata Saathi

The voice-first collection assistant for Paytm merchants. **Record udhaar. Track every rupee. Collect with dignity.**

The merchant speaks in Hindi, Kannada, Tamil, Telugu or English. Khata Saathi reads the entry back, saves it only after the merchant says yes, messages the customer, sends polite reminders with a payment link, and closes the udhaar when a verified payment arrives.

## Quick start (Mac)

```bash
brew install python ffmpeg cloudflared
cd khata-saathi
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then put your SARVAM_API_KEY in .env
uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000. Demo data loads on first start: one shop, 20 customers, two months of history.

Without a Sarvam key the app still runs: use the **Type** button, and replies are spoken by the browser.

## Use it on a phone

Phone browsers only allow the microphone on **https** pages, so use a tunnel:

```bash
cloudflared tunnel --url http://localhost:8000
```

1. Copy the `https://….trycloudflare.com` address it prints.
2. Put it in `.env` as `PUBLIC_BASE_URL=` and restart the server (payment links and the Join QR use it).
3. Open that address on the phone. In the browser menu, choose **Add to Home Screen** so it opens like an app.

The tunnel address changes each time you restart cloudflared, so repeat step 2 when it does.

## Demo script (about 4 minutes)

Roles: one person is the merchant (phone with the app), one is Lakshmi (second phone or laptop on `/customer?id=1`), one presents.

1. **Record.** Merchant taps the mic and says *“Lakshmi ku 150 rupees udhaar, 2 kg rice”*. The app reads it back. Merchant says *“yes”* (or taps Save).
2. **Customer confirms.** Lakshmi’s screen shows the entry with **Correct / Wrong amount** buttons.
3. **Remind.** Demo → **Move time forward 3 days**. Lakshmi gets a polite reminder with **Pay now**.
4. **Collect.** Lakshmi pays ₹100 of ₹150. The shop phone announces *“Lakshmi paid ₹100. ₹50 left.”*
5. **Ask.** Merchant asks *“Who owes me money?”* (answer: 3 customers owe ₹1,240, Ramesh ₹800 for 40 days) and *“How much does Ravi owe?”*
6. **Which Ramesh?** Merchant says *“Ramesh paid 300 cash”*. The app asks which Ramesh.
7. **Request.** Merchant says *“Ask Ravi for 290”*. Ravi gets a payment link.

Rehearse with **Demo → Reset demo data** before each run.

Reminders only go out between 9am and 8pm IST (`QUIET_HOURS=9-20`). **Move time forward** ignores this, so an evening demo still sends them.

## What each part does

| File | Job |
|---|---|
| `app/main.py` | All routes: app API, live events, payment and WhatsApp webhooks, demo controls. The design's short paths (`/voice`, `/actions/{id}/confirm`, `/customers`, `/customers/{id}/ledger`, `/events`, `/demo/seed`, `/demo/fast-forward`) work alongside the `/api/...` ones |
| `app/services.py` | The flows: command → confirm → ledger → messages → reminders → payment |
| `app/understand.py` | Transcript → JSON with the LLM, a code validator, and a rule-based fallback |
| `app/resolver.py` | Matches spoken names to customers (Laxmi = Lakshmi), asks when unsure |
| `app/ledger.py` | Balances and repayment history. All money maths lives here, never in the LLM |
| `app/sarvam.py` | Sarvam speech-to-text, text-to-speech (cached on disk), transliteration, LLM call |
| `app/query.py` | Voice questions, answered with read-only tools |
| `app/payments.py` | Payment links, signature check, each payment counted once. Mock + Paytm placeholder |
| `app/messaging.py` | WhatsApp Cloud API sender and webhook parsing; every message also shows in `/customer` |
| `app/i18n.py` | All phrases in five languages. **Have a native speaker check each one.** |
| `app/seed.py` | Demo data |
| `static/` | Merchant app (`/`), customer phone (`/customer`), pay page (`/pay/…`), join page (`/join/1`) |

Trust rules built in: nothing is saved without the merchant’s yes; if the LLM’s amount isn’t a number that was actually said, code uses the spoken number or asks again; amounts above `MAX_AMOUNT_RUPEES` are refused; the ledger is append-only (removals are reversal rows); reminders need consent, stop at zero balance, pause during disputes, and respect STOP.

## Switching on WhatsApp (optional)

1. In Meta for Developers, create an app with WhatsApp and note the **test number’s Phone number ID** and a **token**. Add your teammates’ phones as test recipients.
2. In `.env`: `MESSAGING_CHANNEL=whatsapp`, `WHATSAPP_TOKEN=…`, `WHATSAPP_PHONE_NUMBER_ID=…`.
3. Webhook URL: `https://<your-tunnel>/webhooks/whatsapp`, verify token = `WHATSAPP_VERIFY_TOKEN`. Subscribe to `messages`.
4. In the app, open each test customer and set their real WhatsApp number.

WhatsApp only delivers free-form and button messages to people who messaged your number in the last 24 hours. **Have each test phone send “hi” to the test number shortly before the demo.** Outside that window WhatsApp needs pre-approved templates. Every message still appears in `/customer`, so that page is your backup screen.

## Paytm payments

`PAYMENT_PROVIDER=mock` hosts its own test payment page and sends signed events through the same verification and ledger code a real provider would. If the organisers give you Paytm sandbox access, fill in `PaytmProvider` in `app/payments.py` (create the link; verify Paytm’s checksum) and set `PAYMENT_PROVIDER=paytm`. If you demo the mock, say so to the judges.

## Saving Sarvam credits

- Spoken replies are cached in `data/tts_cache/`, so each fixed phrase is paid for once.
- Set `TTS_ENABLED=false` while testing logic; the browser voice is used instead.
- Keep `LLM_REASONING_EFFORT` empty for extraction. There are no automatic retries.
- Check usage in the Sarvam dashboard a few times on demo day.

## Troubleshooting

| Problem | Fix |
|---|---|
| Mic does nothing on the phone | Open the **https** tunnel address, not `http://192.168…`. Allow microphone access. |
| “API key was rejected (403)” | Check `SARVAM_API_KEY` in `.env`, then restart. |
| “Rate limit or credits used up (429)” | Check credits in the Sarvam dashboard. |
| “Could not read the recording” | Install ffmpeg (`brew install ffmpeg`) and restart. |
| No Sarvam voice, only the browser’s | Check `TTS_MODEL` / `TTS_SPEAKER` against the Sarvam dashboard; see the server log. |
| No sound on iPhone | Turn off silent mode, and tap the mic once (iPhones block audio until you tap). |
| Wrong words heard | Try `STT_USE_UI_LANGUAGE=true` and pick the language in the app. |
| Payment links point to localhost | Set `PUBLIC_BASE_URL` to the tunnel address and restart. |

This is a hackathon prototype: there is no login, and demo controls are on until you set `DEMO_MODE=false`.
