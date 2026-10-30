"""Core flows.

speak -> understand -> resolve customer -> pending action -> merchant says yes
-> ledger entry -> customer message -> reminder -> payment link -> verified
payment -> balance updated -> reminders stop.
"""
import logging
import threading
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from . import audio, clock, ledger, messaging, payments, query, sarvam
from .config import settings
from .db import SessionLocal
from .events import bus
from .i18n import CASH_SUFFIX, customer_text, items_text, norm_lang, say
from .models import Customer, LedgerEntry, Merchant, Message, PendingAction, Reminder
from .resolver import display_name, name_key, resolve
from .understand import ParsedCommand, understand

log = logging.getLogger("khata.services")

OPEN_STATES = ("awaiting_confirm", "awaiting_choice")
_reminder_lock = threading.Lock()


class FlowError(Exception):
    """A user-facing problem (shown as a message, not a crash)."""


# ============================================================ helpers
def get_merchant(db: Session) -> Merchant:
    merchant = db.scalars(select(Merchant).order_by(Merchant.id)).first()
    if merchant is None:
        raise FlowError("No shop set up yet. Restart the server to load demo data.")
    return merchant


def rupees(paise: int) -> int:
    return ledger.rupees(paise)


def health() -> dict:
    return {
        "voice": settings.voice_enabled,
        "llm": settings.llm_enabled,
        "tts": settings.voice_enabled and settings.tts_enabled,
        "ffmpeg": audio.ffmpeg_available(),
        "messaging": settings.messaging_channel,
        "payments": settings.payment_provider,
        "public_base_url": settings.public_base_url,
        "demo_mode": settings.demo_mode,
    }


def customer_dict(db: Session, c: Customer, bal_paise: int | None = None, with_stats: bool = False) -> dict:
    bal = ledger.balance_paise(db, c.id) if bal_paise is None else bal_paise
    data = {
        "id": c.id, "name": c.display_name, "name_latin": c.name_latin, "note": c.note, "phone": c.phone,
        "language": c.language,
        "consent": c.consent, "reminders_paused": c.reminders_paused, "balance": rupees(bal),
    }
    if with_stats:
        data["stats"] = ledger.customer_stats(db, c)
    return data


def entry_dict(e: LedgerEntry) -> dict:
    return {
        "id": e.id, "type": e.type, "amount": rupees(e.amount_paise), "items": e.items or [], "source": e.source,
        "status": e.status, "customer_ack": e.customer_ack, "reverses_entry_id": e.reverses_entry_id,
        "created_at": e.created_at.isoformat() + "Z",
    }


def state_dict(db: Session) -> dict:
    merchant = get_merchant(db)
    customers = db.scalars(select(Customer).where(Customer.merchant_id == merchant.id)).all()
    bals = ledger.balances(db, merchant.id)
    disputed = dict(db.execute(
        select(LedgerEntry.customer_id, func.count()).where(LedgerEntry.merchant_id == merchant.id,
                                                            LedgerEntry.status == "disputed")
        .group_by(LedgerEntry.customer_id)).all())
    rows = []
    for c in customers:
        row = customer_dict(db, c, bals.get(c.id, 0))
        row["days"] = ledger.fifo_stats(ledger.history(db, c.id))["oldest_unpaid_days"] if row["balance"] > 0 else 0
        row["disputes"] = disputed.get(c.id, 0)
        rows.append(row)
    owing = [r for r in rows if r["balance"] > 0]
    pending = active_pending(db, merchant.id)
    return {
        "merchant": {"id": merchant.id, "shop_name": merchant.shop_name, "language": merchant.language,
                     "phone": merchant.phone},
        "customers": rows,
        "totals": {"owing_count": len(owing), "total": sum(r["balance"] for r in owing)},
        "pending": pending_dict(db, pending) if pending else None,
        "health": health(),
        "clock_offset_days": clock.offset_days(),
        "join_url": f"{settings.public_base_url}/join/{merchant.id}",
    }


# ============================================================ pending actions
def active_pending(db: Session, merchant_id: int) -> PendingAction | None:
    pending = db.scalars(
        select(PendingAction).where(PendingAction.merchant_id == merchant_id, PendingAction.state.in_(OPEN_STATES))
        .order_by(PendingAction.id.desc())
    ).first()
    if pending and pending.expires_at < clock.now():
        pending.state = "expired"
        db.commit()
        return None
    return pending


def _cancel_open_pending(db: Session, merchant_id: int) -> None:
    db.execute(update(PendingAction).where(PendingAction.merchant_id == merchant_id,
                                           PendingAction.state.in_(OPEN_STATES)).values(state="cancelled"))


def _open_pending_or_fail(db: Session, pending_id: int) -> PendingAction:
    pending = db.get(PendingAction, pending_id)
    if pending is None or pending.state not in OPEN_STATES or pending.expires_at < clock.now():
        raise FlowError("That entry is no longer waiting. Say it again.")
    return pending


def pending_dict(db: Session, p: PendingAction) -> dict:
    d = p.data or {}
    customer = db.get(Customer, p.customer_id) if p.customer_id else None
    amount = d.get("amount")
    if p.kind == "request_payment" and amount is None and customer:
        amount = rupees(ledger.balance_paise(db, customer.id))
    return {
        "id": p.id, "kind": p.kind, "state": p.state, "transcript": p.transcript, "amount": amount,
        "items": d.get("items") or [], "payment_mode": d.get("payment_mode"), "spoken_name": d.get("spoken_name"),
        "customer": customer_dict(db, customer) if customer else None, "new_customer_name": p.new_customer_name,
        "options": [customer_dict(db, c) for c in (db.get(Customer, i) for i in (p.options or [])) if c],
    }


def readback(db: Session, p: PendingAction, lang: str, spoken: bool) -> str:
    d = p.data or {}
    if p.state == "awaiting_choice":
        options = [db.get(Customer, i) for i in (p.options or [])]
        names = ", ".join(f"{c.display_name} {c.note}".strip() for c in options if c)
        return say(lang, "which_customer", spoken, name=d.get("spoken_name") or "", options=names)
    customer = db.get(Customer, p.customer_id) if p.customer_id else None
    name = customer.display_name if customer else (p.new_customer_name or "")
    amount = d.get("amount")
    if p.kind == "request_payment" and amount is None and customer:
        amount = rupees(ledger.balance_paise(db, customer.id))
    values = {"name": name, "amount": amount or 0, "items": items_text(d.get("items"))}
    if p.kind == "add_credit":
        return say(lang, "confirm_credit" if customer else "confirm_new_credit", spoken, **values)
    if p.kind == "record_repayment":
        mode = CASH_SUFFIX[norm_lang(lang)] if d.get("payment_mode") == "cash" else ""
        return say(lang, "confirm_repayment", spoken, mode=mode, **values)
    if p.kind == "cash_sale":
        return say(lang, "confirm_cash_sale", spoken, **values)
    return say(lang, "confirm_request", spoken, **values)


def _reply(db: Session, lang: str, *, key: str | None = None, values: dict | None = None, text: str | None = None,
           speak: str | None = None, transcript: str | None = None, parsed: ParsedCommand | None = None,
           pending: PendingAction | None = None, warning: str | None = None, done: dict | None = None) -> dict:
    values = values or {}
    if key:
        text, speak = say(lang, key, False, **values), say(lang, key, True, **values)
    speak = speak or text
    return {
        "transcript": transcript, "parsed": parsed.model_dump() if parsed else None,
        "reply_text": text, "speak_text": speak, "reply_audio_url": sarvam.synthesize(speak, lang),
        "reply_lang": lang, "pending": pending_dict(db, pending) if pending else None,
        "warning": warning, "done": done,
    }


def _reply_pending(db: Session, lang: str, p: PendingAction, **kwargs) -> dict:
    return _reply(db, lang, text=readback(db, p, lang, False), speak=readback(db, p, lang, True), pending=p, **kwargs)


# ============================================================ commands
def handle_command(db: Session, transcript: str, lang: str | None = None) -> dict:
    merchant = get_merchant(db)
    lang = norm_lang(lang or merchant.language)
    transcript = (transcript or "").strip()
    if not transcript:
        return _reply(db, lang, key="not_understood", warning="empty")

    pending = active_pending(db, merchant.id)
    known = [c.display_name for c in db.scalars(select(Customer).where(Customer.merchant_id == merchant.id))]
    summary = readback(db, pending, "en-IN", False) if pending else None
    parsed = understand(transcript, known, pending_summary=summary)

    if parsed.intent in ("confirm", "reject", "correct"):
        if not pending:
            return _reply(db, lang, key="nothing_pending", transcript=transcript, parsed=parsed)
        if parsed.intent == "reject":
            return reject_pending(db, pending.id, lang, transcript=transcript, parsed=parsed)
        if parsed.intent == "correct":
            return correct_pending(db, pending.id, parsed.amount, lang, transcript=transcript, parsed=parsed)
        return confirm_pending(db, pending.id, lang, transcript=transcript, parsed=parsed)

    if parsed.intent == "query":
        text, speak = query.answer(db, merchant, parsed.question or transcript, lang)
        return _reply(db, lang, text=text, speak=speak, transcript=transcript, parsed=parsed,
                      pending=active_pending(db, merchant.id))

    if parsed.intent == "unknown":
        return _reply(db, lang, key="not_understood", transcript=transcript, parsed=parsed, warning=parsed.warning,
                      pending=pending)

    _cancel_open_pending(db, merchant.id)
    return _start_action(db, merchant, parsed, transcript, lang)


def _start_action(db: Session, merchant: Merchant, parsed: ParsedCommand, transcript: str, lang: str) -> dict:
    now = clock.now()
    p = PendingAction(
        merchant_id=merchant.id, kind=parsed.intent, state="awaiting_confirm", transcript=transcript,
        data={"amount": parsed.amount, "items": parsed.items, "payment_mode": parsed.payment_mode,
              "spoken_name": parsed.customer_name},
        options=[], created_at=now, expires_at=now + timedelta(minutes=settings.pending_minutes),
    )
    common = {"transcript": transcript, "parsed": parsed, "warning": parsed.warning}
    if parsed.intent != "cash_sale":
        res = resolve(db, merchant.id, parsed.customer_name or "")
        if res.kind == "match":
            p.customer_id = res.customer.id
        elif res.kind == "choose":
            p.state = "awaiting_choice"
            p.options = [c.id for c in res.options]
            if parsed.intent == "add_credit":
                p.new_customer_name = display_name(parsed.customer_name)
        elif parsed.intent == "add_credit":
            p.new_customer_name = display_name(parsed.customer_name)
        else:
            db.commit()
            return _reply(db, lang, key="unknown_customer", values={"name": display_name(parsed.customer_name)},
                          **common)

    if parsed.intent == "request_payment" and p.customer_id:
        customer = db.get(Customer, p.customer_id)
        if customer.consent != "granted":
            db.commit()
            return _reply(db, lang, key="no_consent", values={"name": customer.display_name}, **common)
        if parsed.amount is None and ledger.balance_paise(db, customer.id) <= 0:
            db.commit()
            return _reply(db, lang, key="customer_clear", values={"name": customer.display_name}, **common)

    db.add(p)
    db.commit()
    return _reply_pending(db, lang, p, **common)


def confirm_pending(db: Session, pending_id: int, lang: str | None = None, **extra) -> dict:
    p = _open_pending_or_fail(db, pending_id)
    merchant = db.get(Merchant, p.merchant_id)
    lang = norm_lang(lang or merchant.language)
    if p.state == "awaiting_choice":
        return _reply_pending(db, lang, p, **extra)
    return _execute(db, merchant, p, lang, **extra)


def reject_pending(db: Session, pending_id: int, lang: str | None = None, **extra) -> dict:
    p = _open_pending_or_fail(db, pending_id)
    merchant = db.get(Merchant, p.merchant_id)
    p.state = "cancelled"
    db.commit()
    return _reply(db, norm_lang(lang or merchant.language), key="cancelled", **extra)


def correct_pending(db: Session, pending_id: int, amount: int | None, lang: str | None = None, **extra) -> dict:
    p = _open_pending_or_fail(db, pending_id)
    merchant = db.get(Merchant, p.merchant_id)
    lang = norm_lang(lang or merchant.language)
    if amount is None or not 1 <= int(amount) <= settings.max_amount_rupees:
        return _reply(db, lang, key="not_understood", pending=p, warning="amount_out_of_range", **extra)
    p.data = {**(p.data or {}), "amount": int(amount)}
    db.commit()
    return _reply_pending(db, lang, p, **extra)


def choose_pending(db: Session, pending_id: int, customer_id: int, lang: str | None = None) -> dict:
    p = _open_pending_or_fail(db, pending_id)
    merchant = db.get(Merchant, p.merchant_id)
    lang = norm_lang(lang or merchant.language)
    customer = db.get(Customer, customer_id)
    if customer is None or customer.merchant_id != merchant.id:
        raise FlowError("That customer doesn't exist.")
    p.customer_id = customer.id
    p.new_customer_name = None
    p.state = "awaiting_confirm"
    if p.kind == "request_payment" and customer.consent != "granted":
        p.state = "cancelled"
        db.commit()
        return _reply(db, lang, key="no_consent", values={"name": customer.display_name})
    db.commit()
    return _reply_pending(db, lang, p)


def new_customer_pending(db: Session, pending_id: int, lang: str | None = None) -> dict:
    p = _open_pending_or_fail(db, pending_id)
    merchant = db.get(Merchant, p.merchant_id)
    lang = norm_lang(lang or merchant.language)
    if p.kind != "add_credit":
        raise FlowError("Only udhaar can start a new customer.")
    p.customer_id = None
    p.new_customer_name = p.new_customer_name or display_name((p.data or {}).get("spoken_name") or "")
    p.state = "awaiting_confirm"
    db.commit()
    return _reply_pending(db, lang, p)


def create_customer(db: Session, merchant: Merchant, name: str, *, phone: str | None = None,
                    language: str | None = None, consent: str = "pending") -> Customer:
    latin = sarvam.transliterate_to_latin(name.strip())
    customer = Customer(
        merchant_id=merchant.id, display_name=display_name(name), name_latin=latin, name_key=name_key(latin),
        language=norm_lang(language or merchant.language), phone=phone, consent=consent,
        consent_at=clock.now() if consent == "granted" else None, created_at=clock.now(),
    )
    db.add(customer)
    db.flush()
    return customer


def _execute(db: Session, merchant: Merchant, p: PendingAction, lang: str, **extra) -> dict:
    d = p.data or {}
    customer = db.get(Customer, p.customer_id) if p.customer_id else None
    amount = d.get("amount")

    if p.kind != "cash_sale" and customer is None:
        if p.kind == "add_credit" and p.new_customer_name:
            customer = create_customer(db, merchant, p.new_customer_name)
        else:
            return _reply(db, lang, key="not_understood", pending=p, **extra)
    if p.kind == "request_payment" and amount is None:
        amount = rupees(ledger.balance_paise(db, customer.id))
        if amount <= 0:
            p.state = "cancelled"
            db.commit()
            return _reply(db, lang, key="customer_clear", values={"name": customer.display_name}, **extra)
    if not amount or amount <= 0:
        return _reply(db, lang, key="not_understood", pending=p, **extra)

    paise = int(amount) * 100
    p.state = "done"

    if p.kind == "cash_sale":
        entry = ledger.add_entry(db, merchant_id=merchant.id, customer_id=None, type="cash_sale",
                                 amount_paise=paise, items=d.get("items"), source="voice", transcript=p.transcript)
        db.commit()
        return _reply(db, lang, key="saved", done={"type": "cash_sale", "entry_id": entry.id}, **extra)

    if p.kind == "request_payment":
        if customer.consent != "granted":
            p.state = "cancelled"
            db.commit()
            return _reply(db, lang, key="no_consent", values={"name": customer.display_name}, **extra)
        send_payment_request(db, merchant, customer, paise)
        db.commit()
        return _reply(db, lang, key="request_sent", values={"name": customer.display_name},
                      done={"type": "request", "customer_id": customer.id}, **extra)

    if p.kind == "add_credit":
        entry = ledger.add_entry(db, merchant_id=merchant.id, customer_id=customer.id, type="credit",
                                 amount_paise=paise, items=d.get("items"), source="voice", transcript=p.transcript)
        db.commit()
        after_credit_saved(db, merchant, customer, entry)
    else:  # record_repayment said by the merchant (cash, or paid outside the app)
        entry = ledger.add_entry(db, merchant_id=merchant.id, customer_id=customer.id, type="repayment",
                                 amount_paise=paise, source="cash" if d.get("payment_mode") != "paytm" else "manual",
                                 transcript=p.transcript)
        db.commit()
        after_repayment(db, merchant, customer, paise, announce=False)

    bal = rupees(ledger.balance_paise(db, customer.id))
    key = "saved_balance" if bal > 0 else "saved_clear"
    return _reply(db, lang, key=key, values={"name": customer.display_name, "balance": bal},
                  done={"type": p.kind, "entry_id": entry.id, "customer_id": customer.id}, **extra)


# ============================================================ follow-ups
def after_credit_saved(db: Session, merchant: Merchant, customer: Customer, entry: LedgerEntry) -> None:
    if customer.consent == "granted":
        lang = customer.language
        bal = rupees(ledger.balance_paise(db, customer.id))
        body = customer_text(lang, "credit_note", shop=merchant.shop_name, amount=rupees(entry.amount_paise),
                             items=items_text(entry.items), balance=bal)
        buttons = [{"id": f"ack:{entry.id}", "title": customer_text(lang, "btn_ack")},
                   {"id": f"dispute:{entry.id}", "title": customer_text(lang, "btn_dispute")}]
        messaging.send(db, customer, kind="credit_note", body=f"{body}\n{customer_text(lang, 'footer')}",
                       buttons=buttons)
    ensure_reminder(db, customer, clock.now() + timedelta(days=settings.default_due_days))
    db.commit()


def after_repayment(db: Session, merchant: Merchant, customer: Customer, paise: int, announce: bool = True) -> None:
    bal = ledger.balance_paise(db, customer.id)
    cancel_reminders(db, customer.id, "paid" if bal <= 0 else "rescheduled after payment")
    if bal > 0:
        ensure_reminder(db, customer, clock.now() + timedelta(days=settings.reminder_gap_days), tone=1)
    db.commit()
    if customer.consent == "granted":
        body = customer_text(customer.language, "receipt", name=customer.display_name, shop=merchant.shop_name,
                             amount=rupees(paise), balance=rupees(max(bal, 0)))
        messaging.send(db, customer, kind="receipt", body=body)
    if announce:
        key = "paid_clear" if bal <= 0 else "paid_left"
        values = {"name": customer.display_name, "amount": rupees(paise), "balance": rupees(bal)}
        _notify_merchant(merchant, "payment", key, values, customer_id=customer.id)


def _notify_merchant(merchant: Merchant, event_type: str, key: str, values: dict, **extra) -> None:
    lang = merchant.language
    bus.publish(f"merchant:{merchant.id}", {
        "type": event_type, "text": say(lang, key, False, **values), "speak_text": say(lang, key, True, **values),
        "lang": lang, **extra,
    })


def send_payment_request(db: Session, merchant: Merchant, customer: Customer, paise: int) -> None:
    link = payments.create_link(db, merchant, customer, paise)
    body = customer_text(customer.language, "payment_request", shop=merchant.shop_name, amount=rupees(paise),
                         link=link.url)
    messaging.send(db, customer, kind="payment_request", body=body, link_url=link.url)


def handle_verified_payment(db: Session, raw_body: bytes, headers: dict) -> dict:
    result = payments.record_verified_payment(db, raw_body, headers)
    if result["status"] == "recorded":
        customer = db.get(Customer, result["customer_id"])
        merchant = db.get(Merchant, customer.merchant_id)
        after_repayment(db, merchant, customer, result["amount_paise"], announce=True)
    return result


# ============================================================ reminders
def ensure_reminder(db: Session, customer: Customer, due_at: datetime, tone: int = 1) -> Reminder:
    existing = db.scalars(select(Reminder).where(Reminder.customer_id == customer.id,
                                                 Reminder.status == "scheduled")).first()
    if existing:
        return existing
    reminder = Reminder(customer_id=customer.id, due_at=due_at, tone_level=tone, status="scheduled")
    db.add(reminder)
    db.flush()
    return reminder


def cancel_reminders(db: Session, customer_id: int, note: str) -> None:
    db.execute(update(Reminder).where(Reminder.customer_id == customer_id, Reminder.status == "scheduled")
               .values(status="cancelled", note=note))


def _quiet_until(when: datetime) -> datetime | None:
    """If QUIET_HOURS="9-20" and it's 22:00 IST, return the next 9:00 IST (as UTC)."""
    if not settings.quiet_hours:
        return None
    try:
        start, end = (int(x) for x in settings.quiet_hours.split("-"))
    except ValueError:
        return None
    local = clock.to_ist(when)
    if start <= local.hour < end:
        return None
    target = local.replace(hour=start, minute=0, second=0, microsecond=0)
    if local.hour >= end:
        target += timedelta(days=1)
    return target.astimezone(timezone.utc).replace(tzinfo=None)


def _send_reminder_message(db: Session, merchant: Merchant, customer: Customer, tone: int, bal_paise: int) -> None:
    link = payments.create_link(db, merchant, customer, bal_paise)
    lang = customer.language
    body = customer_text(lang, f"reminder_{tone}", name=customer.display_name, shop=merchant.shop_name,
                         balance=rupees(bal_paise), link=link.url)
    messaging.send(db, customer, kind="reminder", body=f"{body}\n{customer_text(lang, 'footer')}",
                   link_url=link.url)
    _notify_merchant(merchant, "reminder_sent", "reminder_sent",
                     {"name": customer.display_name, "balance": rupees(bal_paise)}, customer_id=customer.id)


def try_send_reminder(db: Session, merchant: Merchant, reminder: Reminder, ignore_quiet_hours: bool = False) -> bool:
    """Sends one due reminder if every guardrail allows it. Demo controls may skip quiet hours."""
    customer = db.get(Customer, reminder.customer_id)
    now = clock.now()
    bal = ledger.balance_paise(db, customer.id)

    def stop(status: str, note: str) -> bool:
        reminder.status, reminder.note = status, note
        db.commit()
        return False

    if bal <= 0:
        return stop("cancelled", "nothing due")
    if customer.consent != "granted":
        return stop("skipped", "no consent")
    if customer.reminders_paused:
        return stop("skipped", "paused by merchant")
    if db.scalar(select(func.count()).select_from(LedgerEntry)
                 .where(LedgerEntry.customer_id == customer.id, LedgerEntry.status == "disputed")):
        return stop("skipped", "open dispute")
    last = db.scalars(select(Reminder).where(Reminder.customer_id == customer.id, Reminder.status == "sent")
                      .order_by(Reminder.sent_at.desc())).first()
    min_gap = timedelta(hours=settings.min_hours_between_reminders)
    if last and last.sent_at and now - last.sent_at < min_gap:
        reminder.due_at = last.sent_at + min_gap
        db.commit()
        return False
    quiet = None if ignore_quiet_hours else _quiet_until(now)
    if quiet:
        reminder.due_at = quiet
        db.commit()
        return False

    tone = max(1, min(reminder.tone_level, 3))
    reminder.status, reminder.sent_at = "sent", now
    db.flush()
    _send_reminder_message(db, merchant, customer, tone, bal)
    db.add(Reminder(customer_id=customer.id, due_at=now + timedelta(days=settings.reminder_gap_days),
                    tone_level=min(tone + 1, 3), status="scheduled"))
    db.commit()
    return True


def run_due_reminders(ignore_quiet_hours: bool = False) -> int:
    if not _reminder_lock.acquire(blocking=False):
        return 0
    try:
        with SessionLocal() as db:
            merchant = db.scalars(select(Merchant).order_by(Merchant.id)).first()
            if merchant is None:
                return 0
            due = db.scalars(select(Reminder).where(Reminder.status == "scheduled", Reminder.due_at <= clock.now())
                             .order_by(Reminder.due_at)).all()
            sent = 0
            for reminder in due:
                try:
                    sent += int(try_send_reminder(db, merchant, reminder, ignore_quiet_hours))
                except Exception:
                    log.exception("Reminder %s failed", reminder.id)
                    db.rollback()
            return sent
    finally:
        _reminder_lock.release()


def remind_now(db: Session, customer_id: int) -> dict:
    """Merchant tapped "Send reminder now". Still needs consent and a balance."""
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise FlowError("Customer not found.")
    merchant = db.get(Merchant, customer.merchant_id)
    if customer.consent != "granted":
        raise FlowError(say("en-IN", "no_consent", name=customer.display_name))
    bal = ledger.balance_paise(db, customer.id)
    if bal <= 0:
        raise FlowError(say("en-IN", "customer_clear", name=customer.display_name))
    if db.scalar(select(func.count()).select_from(LedgerEntry)
                 .where(LedgerEntry.customer_id == customer.id, LedgerEntry.status == "disputed")):
        raise FlowError(f"{customer.display_name} flagged an entry. Keep or remove it before sending reminders.")
    # The manual button follows the same guardrails as the scheduler: not while paused, at most one per MIN_HOURS.
    if customer.reminders_paused:
        raise FlowError(f"Reminders for {customer.display_name} are paused. Resume them first.")
    last_sent = db.scalars(select(Reminder).where(Reminder.customer_id == customer.id, Reminder.status == "sent")
                           .order_by(Reminder.sent_at.desc())).first()
    min_gap = timedelta(hours=settings.min_hours_between_reminders)
    if last_sent and last_sent.sent_at and clock.now() - last_sent.sent_at < min_gap:
        raise FlowError(f"{customer.display_name} was already reminded today. At most one reminder a day.")
    _send_reminder_message(db, merchant, customer, 1, bal)
    db.add(Reminder(customer_id=customer.id, due_at=clock.now(), tone_level=1, status="sent",
                    sent_at=clock.now(), note="sent by merchant"))
    cancel_reminders(db, customer.id, "rescheduled after manual reminder")
    ensure_reminder(db, customer, clock.now() + timedelta(days=settings.reminder_gap_days), tone=2)
    db.commit()
    return {"ok": True}


# ============================================================ customer side
def handle_customer_reply(db: Session, customer: Customer, *, button_id: str | None = None,
                          text: str | None = None, channel: str = "simulator") -> dict:
    merchant = db.get(Merchant, customer.merchant_id)
    lang = customer.language
    label = text or button_id or ""
    messaging.log_incoming(db, customer, label, channel)
    result = {"action": "logged"}

    if button_id and ":" in button_id:
        action, _, raw_id = button_id.partition(":")
        entry = db.get(LedgerEntry, int(raw_id)) if raw_id.isdigit() else None
        if entry and entry.customer_id == customer.id:
            if action == "ack" and entry.status == "active":
                entry.customer_ack = "ack"
                result = {"action": "ack"}
            elif action == "dispute" and entry.status == "active" and entry.type == "credit":
                entry.customer_ack, entry.status = "disputed", "disputed"
                db.commit()
                messaging.send(db, customer, kind="notice",
                               body=customer_text(lang, "dispute_ack", shop=merchant.shop_name))
                _notify_merchant(merchant, "dispute", "dispute_alert",
                                 {"name": customer.display_name, "amount": rupees(entry.amount_paise)},
                                 customer_id=customer.id, entry_id=entry.id)
                result = {"action": "dispute"}
    else:
        word = (text or "").strip().upper()
        if word in ("STOP", "STOP REMINDERS", "UNSUBSCRIBE"):
            customer.consent = "opted_out"
            cancel_reminders(db, customer.id, "customer opted out")
            db.commit()
            messaging.send(db, customer, kind="notice", body=customer_text(lang, "optout_ack", shop=merchant.shop_name))
            result = {"action": "opted_out"}
        elif word == "START":
            _grant_consent(db, customer)
            result = {"action": "opted_in"}
    db.commit()
    bus.publish(f"merchant:{merchant.id}", {"type": "refresh"})
    return result


def _grant_consent(db: Session, customer: Customer) -> None:
    customer.consent = "granted"
    customer.consent_at = clock.now()
    if ledger.balance_paise(db, customer.id) > 0 and not customer.reminders_paused:
        ensure_reminder(db, customer, clock.now() + timedelta(days=settings.default_due_days))


def resolve_dispute(db: Session, entry_id: int, action: str) -> dict:
    entry = db.get(LedgerEntry, entry_id)
    if entry is None or entry.status != "disputed":
        raise FlowError("That entry isn't disputed.")
    customer = db.get(Customer, entry.customer_id)
    entry.status = "active"
    if action == "keep":
        entry.customer_ack = "kept"
    elif action == "remove":
        entry.customer_ack = "removed"
        ledger.reverse_entry(db, entry)
    else:
        raise FlowError("Choose keep or remove.")
    if ledger.balance_paise(db, customer.id) > 0 and customer.consent == "granted":
        ensure_reminder(db, customer, clock.now() + timedelta(days=settings.default_due_days))
    db.commit()
    return {"ok": True, "balance": rupees(ledger.balance_paise(db, customer.id))}


def update_customer(db: Session, customer_id: int, changes: dict) -> dict:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise FlowError("Customer not found.")
    if "phone" in changes:
        customer.phone = (changes["phone"] or "").strip() or None
    if "note" in changes:
        customer.note = (changes["note"] or "").strip()
    if "language" in changes:
        customer.language = norm_lang(changes["language"])
    if "reminders_paused" in changes:
        customer.reminders_paused = bool(changes["reminders_paused"])
        if customer.reminders_paused:
            cancel_reminders(db, customer.id, "paused by merchant")
        elif customer.consent == "granted" and ledger.balance_paise(db, customer.id) > 0:
            ensure_reminder(db, customer, clock.now() + timedelta(days=settings.reminder_gap_days))
    if "consent" in changes and changes["consent"] in ("granted", "pending", "opted_out"):
        if changes["consent"] == "granted" and customer.consent != "granted":
            _grant_consent(db, customer)
        elif changes["consent"] != "granted":
            customer.consent = changes["consent"]
            cancel_reminders(db, customer.id, "consent removed")
    db.commit()
    return customer_detail(db, customer.id)


def customer_detail(db: Session, customer_id: int) -> dict:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise FlowError("Customer not found.")
    data = customer_dict(db, customer, with_stats=True)
    data["entries"] = [entry_dict(e) for e in ledger.history(db, customer.id, limit=40)]
    next_reminder = db.scalars(select(Reminder).where(Reminder.customer_id == customer.id,
                                                      Reminder.status == "scheduled")).first()
    data["next_reminder_at"] = next_reminder.due_at.isoformat() + "Z" if next_reminder else None
    return data


def customer_ledger(db: Session, customer_id: int) -> dict:
    """Every ledger row for one customer, newest first, with the balance."""
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise FlowError("Customer not found.")
    return {"customer": customer_dict(db, customer),
            "entries": [entry_dict(e) for e in ledger.history(db, customer.id)]}


def join_khata(db: Session, merchant_id: int, name: str, phone: str, language: str) -> dict:
    merchant = db.get(Merchant, merchant_id)
    if merchant is None:
        raise FlowError("Shop not found.")
    digits = messaging.phone_digits(phone)
    if len(digits) < 10:
        raise FlowError("Enter a 10-digit mobile number.")
    customers = db.scalars(select(Customer).where(Customer.merchant_id == merchant.id)).all()
    customer = next((c for c in customers if messaging.phone_digits(c.phone)[-10:] == digits[-10:]), None)
    if customer is None:
        res = resolve(db, merchant.id, name)
        candidate = res.customer if res.kind == "match" else None
        customer = candidate if candidate and not candidate.phone else None
    if customer is None:
        customer = create_customer(db, merchant, name, phone=phone, language=language, consent="granted")
    customer.phone = phone
    customer.language = norm_lang(language)
    _grant_consent(db, customer)
    db.commit()
    _notify_merchant(merchant, "joined", "joined", {"name": customer.display_name}, customer_id=customer.id)
    return {"ok": True, "customer_id": customer.id, "name": customer.display_name}


def customer_view(db: Session, customer_id: int) -> dict:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise FlowError("Customer not found.")
    merchant = db.get(Merchant, customer.merchant_id)
    messages = db.scalars(select(Message).where(Message.customer_id == customer.id).order_by(Message.id)).all()
    return {"customer": customer_dict(db, customer), "shop": merchant.shop_name,
            "messages": [messaging.message_dict(m) for m in messages]}
