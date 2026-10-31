"""Khata Saathi API and pages. Run: uvicorn app.main:app --reload --port 8000"""
import asyncio
import hmac
import io
import json
import logging
from contextlib import asynccontextmanager
from urllib.parse import urlencode

import qrcode
import qrcode.image.svg
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import (FileResponse, HTMLResponse, JSONResponse, PlainTextResponse, RedirectResponse,
                               Response, StreamingResponse)
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import audio, clock, ledger, messaging, notifications, payments, sarvam, seed, services
from .config import STATIC_DIR, TTS_DIR, settings
from .db import SessionLocal, get_db, init_db
from .events import bus
from .i18n import norm_lang
from .models import Customer, Merchant, PaymentLink

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("khata")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    with SessionLocal() as db:
        if db.scalars(select(Merchant)).first() is None:
            clock.reset()  # a fresh database starts at today, even if an old demo moved the clock
            seed.seed(db)
            log.info("Loaded demo data.")
    bus.bind_loop(asyncio.get_running_loop())
    scheduler = None
    if settings.scheduler_enabled:
        from apscheduler.schedulers.background import BackgroundScheduler

        scheduler = BackgroundScheduler(daemon=True)
        scheduler.add_job(services.run_due_reminders, "interval", seconds=30, id="reminders",
                          max_instances=1, coalesce=True)
        scheduler.start()
    log.info("Voice: %s | LLM: %s | Messaging: %s | Payments: %s | Public URL: %s",
             settings.voice_enabled, settings.llm_enabled, settings.messaging_channel,
             settings.payment_provider, settings.public_base_url)
    log.info("Other devices: open %s/?key=%s once (this computer needs no key).%s", settings.public_base_url,
             settings.merchant_key,
             " This key changes on every restart; set MERCHANT_KEY in .env to keep it."
             if settings.merchant_key_generated else "")
    if settings.messaging_channel == "whatsapp" and not settings.whatsapp_app_secret:
        log.warning("WHATSAPP_APP_SECRET is empty, so incoming WhatsApp messages will be rejected.")
    yield
    if scheduler:
        scheduler.shutdown(wait=False)


app = FastAPI(title="Khata Saathi", lifespan=lifespan)

# ------------------------------------------------------------------ access
# Open to anyone: what customers and outside services use. The link id or webhook signature is the check.
PUBLIC_PREFIXES = ("/pay/", "/api/pay/", "/join/", "/api/join/", "/webhooks/", "/static/", "/audio/",
                   "/manifest.webmanifest", "/sw.js")
KEY_COOKIE = "khata_key"
LOCAL_HOSTS = ("127.0.0.1", "::1", "localhost")
# Headers a tunnel or proxy adds. cloudflared connects from 127.0.0.1, so these tell it apart from this computer.
PROXY_HEADERS = ("cf-connecting-ip", "x-forwarded-for", "x-real-ip", "forwarded")
LOCKED_PAGE = """<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Khata Saathi</title><body style="font-family:system-ui;max-width:28rem;margin:4rem auto;padding:0 1rem">
<h1>Khata Saathi is locked</h1><p>Open the app link that ends in <code>?key=…</code> once on this phone.
The server prints it when it starts.</p></body>"""


def _is_this_computer(request: Request) -> bool:
    host = request.client.host if request.client else ""
    return host in LOCAL_HOSTS and not any(h in request.headers for h in PROXY_HEADERS)


@app.middleware("http")
async def merchant_access(request: Request, call_next):
    path = request.url.path
    if path.startswith(PUBLIC_PREFIXES) or _is_this_computer(request):
        return await call_next(request)
    key = settings.merchant_key
    given = request.query_params.get("key")
    if given is not None and hmac.compare_digest(given, key):
        # Remember this device, then drop the key from the address bar (and from browser history).
        rest = urlencode([(k, v) for k, v in request.query_params.multi_items() if k != "key"])
        response = RedirectResponse(path + (f"?{rest}" if rest else ""), status_code=303)
        https = request.headers.get("x-forwarded-proto", request.url.scheme) == "https"
        response.set_cookie(KEY_COOKIE, key, max_age=365 * 86400, httponly=True, samesite="lax", secure=https)
        return response
    if hmac.compare_digest(request.cookies.get(KEY_COOKIE, ""), key):
        return await call_next(request)
    if path.startswith("/api/") or request.method != "GET":
        return JSONResponse(status_code=401, content={"detail": "Locked. Open the app link with ?key= on this device."})
    return HTMLResponse(LOCKED_PAGE, status_code=401)


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/audio", StaticFiles(directory=TTS_DIR), name="audio")


@app.exception_handler(services.FlowError)
async def _flow_error(_request: Request, exc: services.FlowError):
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.exception_handler(sarvam.SarvamError)
async def _sarvam_error(_request: Request, exc: sarvam.SarvamError):
    return JSONResponse(status_code=502, content={"detail": str(exc)})


@app.exception_handler(audio.AudioError)
async def _audio_error(_request: Request, exc: audio.AudioError):
    return JSONResponse(status_code=400, content={"detail": str(exc)})


# ------------------------------------------------------------------ pages
def _page(name: str) -> FileResponse:
    return FileResponse(STATIC_DIR / name, headers={"Cache-Control": "no-cache"})


# --- React merchant app (web/ → static/app). Falls back to the original one-screen UI if it isn't built. ---
# Revert: delete static/app (or just use /legacy). Nothing else changed.
REACT_INDEX = STATIC_DIR / "app" / "index.html"


@app.get("/", include_in_schema=False)
def page_merchant():
    if REACT_INDEX.exists():
        return FileResponse(REACT_INDEX, headers={"Cache-Control": "no-cache"})
    return _page("index.html")


@app.get("/legacy", include_in_schema=False)
def page_merchant_legacy():
    return _page("index.html")


@app.get("/customer", include_in_schema=False)
def page_customer():
    return _page("customer.html")


@app.get("/pay/{link_id}", include_in_schema=False)
def page_pay(link_id: str):
    return _page("pay.html")


@app.get("/join/{merchant_id}", include_in_schema=False)
def page_join(merchant_id: int):
    return _page("join.html")


@app.get("/manifest.webmanifest", include_in_schema=False)
def manifest():
    return FileResponse(STATIC_DIR / "manifest.webmanifest", media_type="application/manifest+json")


@app.get("/sw.js", include_in_schema=False)
def service_worker():
    return FileResponse(STATIC_DIR / "sw.js", media_type="text/javascript", headers={"Cache-Control": "no-cache"})


# ------------------------------------------------------------------ merchant app
class CommandIn(BaseModel):
    text: str
    lang: str | None = None
    customer_id: int | None = None  # set by screens that already show one customer


class AmountIn(BaseModel):
    amount: int


class ChooseIn(BaseModel):
    customer_id: int


class LangIn(BaseModel):
    lang: str | None = None


class MerchantIn(BaseModel):
    language: str | None = None
    shop_name: str | None = None
    phone: str | None = None


class CustomerPatch(BaseModel):
    name: str | None = None
    balance: int | None = None  # what the customer owes now, in rupees; the difference is booked as an adjustment
    phone: str | None = None
    note: str | None = None
    language: str | None = None
    consent: str | None = None
    reminders_paused: bool | None = None
    reminder_note: str | None = None


class NewCustomerIn(BaseModel):
    name: str
    phone: str | None = None
    note: str | None = None


class ResolveIn(BaseModel):
    action: str


@app.get("/api/health")
def api_health():
    return services.health()


@app.get("/api/state")
def api_state(db: Session = Depends(get_db)):
    return services.state_dict(db)


@app.get("/api/notifications")
def api_notifications(db: Session = Depends(get_db)):
    """Tasks and alerts for the shopkeeper, derived from the ledger (see app/notifications.py). Read-only."""
    merchant = services.get_merchant(db)
    return notifications.build(db, merchant.id, merchant.language)


@app.get("/api/stats")
def api_stats(db: Session = Depends(get_db)):
    """Read-only numbers for the home-screen charts (React UI): last 7 days given vs received, and who owes, sorted."""
    merchant = services.get_merchant(db)
    return {"week": ledger.weekly_summary(db, merchant.id), "outstanding": ledger.outstanding(db, merchant.id)}


@app.patch("/api/merchant")
def api_merchant(body: MerchantIn, db: Session = Depends(get_db)):
    merchant = services.get_merchant(db)
    if body.language:
        merchant.language = norm_lang(body.language)
        services.sync_demo_languages(db, merchant)  # demo data follows the shop; no-op in production
    if body.shop_name:
        merchant.shop_name = body.shop_name.strip()[:120]
    if body.phone is not None:
        merchant.phone = body.phone.strip()[:32] or None
    db.commit()
    return {"ok": True}


@app.post("/api/voice")
@app.post("/voice", include_in_schema=False)
def api_voice(file: UploadFile = File(...), lang: str | None = Form(None), db: Session = Depends(get_db)):
    raw = file.file.read()
    wav = audio.to_wav(raw, file.filename or "speech.webm")
    stt_lang = settings.stt_language_code or (norm_lang(lang) if settings.stt_use_ui_language and lang else None)
    result = sarvam.transcribe(wav, stt_lang)
    log.info("Heard: %r (%s)", result["transcript"], result.get("language_code"))
    return services.handle_command(db, result["transcript"], lang)


@app.post("/api/command")
def api_command(body: CommandIn, db: Session = Depends(get_db)):
    return services.handle_command(db, body.text, body.lang, body.customer_id)


@app.post("/api/actions/{pending_id}/confirm")
@app.post("/actions/{pending_id}/confirm", include_in_schema=False)
def api_confirm(pending_id: int, body: LangIn | None = None, db: Session = Depends(get_db)):
    return services.confirm_pending(db, pending_id, body.lang if body else None)


@app.post("/api/actions/{pending_id}/reject")
@app.post("/actions/{pending_id}/reject", include_in_schema=False)
def api_reject(pending_id: int, body: LangIn | None = None, db: Session = Depends(get_db)):
    return services.reject_pending(db, pending_id, body.lang if body else None)


@app.post("/api/actions/{pending_id}/correct")
@app.post("/actions/{pending_id}/correct", include_in_schema=False)
def api_correct(pending_id: int, body: AmountIn, db: Session = Depends(get_db)):
    return services.correct_pending(db, pending_id, body.amount)


@app.post("/api/actions/{pending_id}/choose")
def api_choose(pending_id: int, body: ChooseIn, db: Session = Depends(get_db)):
    return services.choose_pending(db, pending_id, body.customer_id)


@app.post("/api/actions/{pending_id}/new-customer")
def api_new_customer(pending_id: int, db: Session = Depends(get_db)):
    return services.new_customer_pending(db, pending_id)


@app.get("/api/customers")
@app.get("/customers", include_in_schema=False)
def api_customers(db: Session = Depends(get_db)):
    state = services.state_dict(db)
    return {"customers": state["customers"], "totals": state["totals"]}


@app.post("/api/customers")
def api_customer_add(body: NewCustomerIn, db: Session = Depends(get_db)):
    """Add a customer with nothing owed yet (udhaar entries create customers on their own)."""
    return services.add_customer(db, body.name, phone=body.phone, note=body.note)


@app.get("/api/customers/{customer_id}/ledger")
@app.get("/customers/{customer_id}/ledger", include_in_schema=False)
def api_customer_ledger(customer_id: int, db: Session = Depends(get_db)):
    return services.customer_ledger(db, customer_id)


@app.get("/api/customers/{customer_id}")
def api_customer(customer_id: int, db: Session = Depends(get_db)):
    return services.customer_detail(db, customer_id)


@app.patch("/api/customers/{customer_id}")
def api_customer_patch(customer_id: int, body: CustomerPatch, db: Session = Depends(get_db)):
    return services.update_customer(db, customer_id, body.model_dump(exclude_unset=True))


@app.get("/api/customers/{customer_id}/reminder-preview")
def api_reminder_preview(customer_id: int, db: Session = Depends(get_db)):
    """The next reminder's text for this customer (default sentence + merchant's note + STOP line), link as a placeholder."""
    return services.reminder_preview(db, customer_id)


@app.post("/api/customers/{customer_id}/remind")
def api_remind(customer_id: int, db: Session = Depends(get_db)):
    return services.remind_now(db, customer_id)


@app.post("/api/entries/{entry_id}/resolve")
def api_resolve(entry_id: int, body: ResolveIn, db: Session = Depends(get_db)):
    return services.resolve_dispute(db, entry_id, body.action)


@app.get("/api/tts")
def api_tts(text: str, lang: str = "en-IN"):
    return {"audio_url": sarvam.synthesize(text[:500], norm_lang(lang))}


@app.get("/api/events")
@app.get("/events", include_in_schema=False)
async def api_events(request: Request, channel: str):
    queue = bus.subscribe(channel)

    async def stream():
        try:
            yield "retry: 3000\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=15)
                    yield f"data: {data}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        finally:
            bus.unsubscribe(channel, queue)

    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ------------------------------------------------------------------ customer phone (simulator)
class ReplyIn(BaseModel):
    button_id: str | None = None
    text: str | None = None


@app.get("/api/customer-view")
def api_customer_list(db: Session = Depends(get_db)):
    merchant = services.get_merchant(db)
    customers = db.scalars(select(Customer).where(Customer.merchant_id == merchant.id)
                           .order_by(Customer.display_name)).all()
    return {"customers": [{"id": c.id, "name": c.display_name, "note": c.note} for c in customers]}


@app.get("/api/customer-view/{customer_id}")
def api_customer_view(customer_id: int, db: Session = Depends(get_db)):
    return services.customer_view(db, customer_id)


@app.post("/api/customer-view/{customer_id}/reply")
def api_customer_reply(customer_id: int, body: ReplyIn, db: Session = Depends(get_db)):
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(404, "Customer not found.")
    return services.handle_customer_reply(db, customer, button_id=body.button_id, text=body.text)


# ------------------------------------------------------------------ payments
class SimulateIn(BaseModel):
    amount: int | None = None


@app.get("/api/pay/{link_id}")
def api_pay_info(link_id: str, db: Session = Depends(get_db)):
    link = db.get(PaymentLink, link_id)
    if link is None:
        raise HTTPException(404, "This payment link doesn't exist.")
    customer = db.get(Customer, link.customer_id)
    merchant = db.get(Merchant, link.merchant_id)
    return {"link_id": link.id, "status": link.status, "shop": merchant.shop_name,
            "customer_id": customer.id, "customer_name": customer.display_name,
            "amount": ledger.rupees(link.amount_paise),
            "balance": ledger.rupees(ledger.balance_paise(db, customer.id)),
            "language": customer.language, "provider": settings.payment_provider}


@app.post("/api/pay/{link_id}/simulate")
def api_pay_simulate(link_id: str, body: SimulateIn, db: Session = Depends(get_db)):
    """Mock payment page: builds a signed event and sends it through the real webhook code."""
    if settings.payment_provider != "mock":
        raise HTTPException(400, "Test payments are only available with PAYMENT_PROVIDER=mock.")
    link = db.get(PaymentLink, link_id)
    if link is None:
        raise HTTPException(404, "This payment link doesn't exist.")
    if link.status == "paid":
        raise HTTPException(400, "This link has already been paid. Use the newest link from the shop.")
    balance = ledger.rupees(ledger.balance_paise(db, link.customer_id))
    if balance <= 0:
        raise HTTPException(400, "Nothing left to pay.")
    amount = body.amount if body.amount is not None else min(ledger.rupees(link.amount_paise), balance)
    if not 1 <= amount <= balance:
        raise HTTPException(400, f"Enter an amount between ₹1 and ₹{balance:,}.")
    raw, headers = payments.build_mock_event(link, amount * 100)
    result = services.handle_verified_payment(db, raw, headers)
    return {**result, "amount": amount,
            "balance": ledger.rupees(ledger.balance_paise(db, link.customer_id))}


@app.post("/webhooks/payment")
async def webhook_payment(request: Request):
    raw = await request.body()
    headers = dict(request.headers)
    with SessionLocal() as db:
        try:
            return services.handle_verified_payment(db, raw, headers)
        except payments.PaymentVerificationError as exc:
            log.warning("Rejected payment webhook: %s", exc)
            raise HTTPException(400, str(exc))
        except NotImplementedError as exc:
            raise HTTPException(501, str(exc))


# ------------------------------------------------------------------ WhatsApp
@app.get("/webhooks/whatsapp")
def whatsapp_verify(request: Request):
    params = request.query_params
    if params.get("hub.mode") == "subscribe" and params.get("hub.verify_token") == settings.whatsapp_verify_token:
        return PlainTextResponse(params.get("hub.challenge", ""))
    raise HTTPException(403, "Verification failed.")


@app.post("/webhooks/whatsapp")
async def whatsapp_incoming(request: Request):
    raw = await request.body()
    if not messaging.verify_whatsapp_signature(raw, request.headers.get("x-hub-signature-256")):
        raise HTTPException(403, "Bad signature.")
    try:
        payload = json.loads(raw or b"{}")
    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid JSON.")
    handled = 0
    with SessionLocal() as db:
        customers = db.scalars(select(Customer)).all()
        for item in messaging.parse_whatsapp_webhook(payload):
            digits = messaging.phone_digits(item["phone"])[-10:]
            customer = next((c for c in customers if messaging.phone_digits(c.phone)[-10:] == digits), None)
            if customer:
                services.handle_customer_reply(db, customer, button_id=item["button_id"], text=item["text"],
                                               channel="whatsapp")
                handled += 1
    return {"ok": True, "handled": handled}


# ------------------------------------------------------------------ join my khata
class JoinIn(BaseModel):
    name: str
    phone: str
    language: str = "ta-IN"
    consent: bool = False


@app.get("/api/join/{merchant_id}")
def api_join_info(merchant_id: int, db: Session = Depends(get_db)):
    merchant = db.get(Merchant, merchant_id)
    if merchant is None:
        raise HTTPException(404, "Shop not found.")
    return {"shop": merchant.shop_name, "language": merchant.language}


@app.post("/api/join/{merchant_id}")
def api_join(merchant_id: int, body: JoinIn, db: Session = Depends(get_db)):
    if not body.consent:
        raise HTTPException(400, "Tick the box to agree to updates and reminders.")
    if not body.name.strip():
        raise HTTPException(400, "Enter your name.")
    return services.join_khata(db, merchant_id, body.name.strip(), body.phone.strip(), body.language)


@app.get("/api/join-qr.svg", include_in_schema=False)
def api_join_qr(db: Session = Depends(get_db)):
    merchant = services.get_merchant(db)
    image = qrcode.make(f"{settings.public_base_url}/join/{merchant.id}", image_factory=qrcode.image.svg.SvgPathImage,
                        box_size=12, border=2)
    buffer = io.BytesIO()
    image.save(buffer)
    return Response(buffer.getvalue(), media_type="image/svg+xml")


# ------------------------------------------------------------------ demo controls
class ForwardIn(BaseModel):
    days: float = 3


def _demo_only():
    if not settings.demo_mode:
        raise HTTPException(403, "Demo controls are off (DEMO_MODE=false).")


@app.get("/api/demo/clock")
def api_clock():
    return {"offset_days": clock.offset_days(), "now": clock.now().isoformat() + "Z"}


@app.post("/api/demo/fast-forward")
@app.post("/demo/fast-forward", include_in_schema=False)
def api_fast_forward(body: ForwardIn, db: Session = Depends(get_db)):
    _demo_only()
    clock.advance(max(0.0, min(body.days, 30.0)))
    sent = services.run_due_reminders(ignore_quiet_hours=True)
    merchant = services.get_merchant(db)
    bus.publish(f"merchant:{merchant.id}", {"type": "refresh"})
    return {"offset_days": clock.offset_days(), "reminders_sent": sent}


@app.post("/api/demo/run-reminders")
def api_run_reminders():
    _demo_only()
    return {"reminders_sent": services.run_due_reminders(ignore_quiet_hours=True)}


@app.post("/api/demo/reset")
@app.post("/api/demo/seed")
@app.post("/demo/seed", include_in_schema=False)
def api_reset():
    _demo_only()
    seed.reset_and_seed()
    with SessionLocal() as db:
        merchant = services.get_merchant(db)
        bus.publish(f"merchant:{merchant.id}", {"type": "refresh"})
    return {"ok": True}


# ------------------------------------------------------------------ React app routes (must stay last)
# /khata, /khata/3, /reminders, /account ... are client-side routes of the React app in static/app.
# Registered after every real route, so API, static files, webhooks and the original pages win.
_RESERVED_PREFIXES = ("api/", "static/", "audio/", "webhooks/", "customer", "pay/", "join/", "manifest.webmanifest", "sw.js", "legacy")


@app.get("/{path:path}", include_in_schema=False)
def react_spa_fallback(path: str):
    if not REACT_INDEX.exists() or path.startswith(_RESERVED_PREFIXES) or "." in path.rsplit("/", 1)[-1]:
        raise HTTPException(404, "Not found.")
    return FileResponse(REACT_INDEX, headers={"Cache-Control": "no-cache"})
