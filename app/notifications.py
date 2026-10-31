"""Merchant notifications: tasks and alerts derived from the ledger, reminders, payments and customers.

Nothing is stored; every item is computed from what already happened, so it can never disagree with the khata.
Two kinds:
- "action": things that need the shopkeeper now (a flagged entry, someone silent after reminders, a debtor who
  can't be reminded). Always shown, regardless of age, while the condition holds.
- events ("payments", "reminders", "customers"): what happened in the last WINDOW_DAYS, newest first.
Read-only. Follows the demo clock.
"""
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import clock, ledger
from .config import settings
from .models import Customer, LedgerEntry, Payment, Reminder

WINDOW_DAYS = 14


def _iso(dt) -> str:
    return dt.isoformat() + "Z"


def _days_ago(dt) -> int:
    return max(0, int((clock.now() - dt).total_seconds() // 86400))


def build(db: Session, merchant_id: int) -> dict:
    now = clock.now()
    since = now - timedelta(days=WINDOW_DAYS)
    customers = {c.id: c for c in db.scalars(select(Customer).where(Customer.merchant_id == merchant_id))}
    balances = ledger.balances(db, merchant_id)
    bal = lambda cid: ledger.rupees(balances.get(cid, 0))  # noqa: E731
    items: list[dict] = []

    def add(kind: str, category: str, customer: Customer | None, title: str, body: str, at, *,
            amount: int | None = None, urgent: bool = False, action: str | None = None, uid: str = ""):
        items.append({
            "id": f"{kind}:{uid or (customer.id if customer else 0)}:{at.strftime('%Y%m%d%H%M%S') if at else ''}",
            "kind": kind, "category": category,
            "customer_id": customer.id if customer else None,
            "customer_name": customer.display_name if customer else None,
            "title": title, "body": body, "amount": amount,
            "at": _iso(at) if at else _iso(now), "urgent": urgent,
            "action": {"label": action, "to": f"/khata/{customer.id}"} if action and customer else None,
        })

    # ---- needs action (current state) -------------------------------------------------------------
    disputed = db.scalars(select(LedgerEntry).where(LedgerEntry.merchant_id == merchant_id,
                                                   LedgerEntry.status == "disputed")).all()
    for e in disputed:
        c = customers.get(e.customer_id)
        if c is None:
            continue
        add("flagged", "action", c, f"{c.display_name} flagged ₹{ledger.rupees(e.amount_paise):,}",
            "Says the entry is wrong. Keep or remove it; reminders are paused until you do.",
            e.created_at, amount=ledger.rupees(e.amount_paise), urgent=True, action="Resolve", uid=str(e.id))

    sent_reminders = db.scalars(select(Reminder).where(Reminder.status == "sent")
                                .order_by(Reminder.sent_at.desc())).all()
    last_sent: dict[int, Reminder] = {}
    first_sent: dict[int, Reminder] = {}
    sent_count: dict[int, int] = {}
    for r in sent_reminders:  # newest first
        if r.customer_id in customers and r.sent_at:
            last_sent.setdefault(r.customer_id, r)
            first_sent[r.customer_id] = r
            sent_count[r.customer_id] = sent_count.get(r.customer_id, 0) + 1

    repayments = db.scalars(select(LedgerEntry).where(LedgerEntry.merchant_id == merchant_id,
                                                     LedgerEntry.type == "repayment",
                                                     LedgerEntry.status == "active")
                            .order_by(LedgerEntry.created_at.desc())).all()
    last_paid = {}
    for e in repayments:
        last_paid.setdefault(e.customer_id, e.created_at)

    # "Amount wrong?" tapped on a reminder leaves a cancelled Reminder row with this note (services.handle_customer_reply).
    flagged_balance = {}
    for r in db.scalars(select(Reminder).where(Reminder.status == "cancelled", Reminder.note == "balance flagged by customer")
                        .order_by(Reminder.due_at.desc())):
        flagged_balance.setdefault(r.customer_id, r.due_at)

    gap = timedelta(days=settings.reminder_gap_days)
    for cid, c in customers.items():
        owed = bal(cid)
        if owed <= 0:
            continue
        flagged_at = flagged_balance.get(cid)
        if flagged_at and not (last_paid.get(cid) and last_paid[cid] > flagged_at):
            add("balance_flagged", "action", c, f"{c.display_name} says the amount is wrong",
                f"₹{owed:,} pending. Reminders are paused. Check their record, then call or resume.",
                flagged_at, amount=owed, urgent=True, action="Open")
            continue
        if c.consent == "pending":
            add("no_consent", "action", c, f"Can't remind {c.display_name}",
                f"₹{owed:,} pending, but they haven't joined WhatsApp updates. Share the Join QR or ask in person.",
                None, amount=owed, action="Open")
        elif c.consent == "opted_out":
            add("opted_out", "action", c, f"{c.display_name} stopped reminders",
                f"₹{owed:,} pending. They replied STOP, so only a word in person now.", None, amount=owed, action="Open")
        elif c.reminders_paused:
            add("paused", "action", c, f"Reminders paused for {c.display_name}",
                f"₹{owed:,} pending. Resume when you're ready.", None, amount=owed, action="Resume")
        # Silent after reminders: nothing paid since the first reminder, and either two or more have gone out
        # or the only one was sent a full reminder-gap ago. The scheduler keeps nudging; this tells the merchant.
        r = last_sent.get(cid)
        first = first_sent.get(cid)
        n = sent_count.get(cid, 0)
        paid_since = bool(first and last_paid.get(cid) and last_paid[cid] > first.sent_at)
        if r and first and not paid_since and (n >= 2 or now - r.sent_at >= gap):
            add("unpaid_after_reminder", "action", c,
                f"{c.display_name} hasn't paid after {n} reminder{'s' if n > 1 else ''}",
                f"₹{owed:,} pending · last reminded {_days_ago(r.sent_at)} days ago. Maybe a call, or a smaller amount?",
                r.sent_at, amount=owed, urgent=n >= 2, action="Open")

    # ---- payments ------------------------------------------------------------------------------------
    for p in db.scalars(select(Payment).where(Payment.verified_at >= since).order_by(Payment.verified_at.desc())):
        c = customers.get(p.customer_id)
        if c is None:
            continue
        amt = ledger.rupees(p.amount_paise)
        left = bal(c.id)
        settled = left <= 0 and last_paid.get(c.id) and last_paid[c.id] <= p.verified_at + timedelta(seconds=5)
        add("payment", "payments", c,
            f"{c.display_name} paid ₹{amt:,}" + (" · settled up" if settled else ""),
            ("Verified via Paytm. Balance is zero, reminders stopped." if settled else f"Verified via Paytm. ₹{left:,} still pending."),
            p.verified_at, amount=amt, uid=str(p.id))
    for e in repayments:
        if e.created_at < since or e.payment_id is not None or e.source != "cash":
            continue
        c = customers.get(e.customer_id)
        if c is None:
            continue
        amt = ledger.rupees(e.amount_paise)
        left = bal(c.id)
        add("cash", "payments", c, f"Noted ₹{amt:,} cash from {c.display_name}" + (" · settled up" if left <= 0 else ""),
            "Cash at the counter, recorded after your yes." + ("" if left <= 0 else f" ₹{left:,} still pending."),
            e.created_at, amount=amt, uid=str(e.id))

    # ---- reminders -----------------------------------------------------------------------------------
    for r in sent_reminders:
        c = customers.get(r.customer_id)
        if c is None or not r.sent_at or r.sent_at < since:
            continue
        add("reminder_sent", "reminders", c, f"Reminder sent to {c.display_name}",
            f"Nudge {r.tone_level} of 3 on WhatsApp, with a payment link." + (f" ₹{bal(c.id):,} pending." if bal(c.id) > 0 else " Paid since."),
            r.sent_at, uid=str(r.id))
    for r in db.scalars(select(Reminder).where(Reminder.status == "scheduled", Reminder.due_at <= now + timedelta(days=1))):
        c = customers.get(r.customer_id)
        if c is None or bal(c.id) <= 0:
            continue
        add("reminder_due", "reminders", c, f"Reminder to {c.display_name} goes out {'today' if r.due_at <= now + timedelta(hours=12) else 'tomorrow'}",
            f"₹{bal(c.id):,} pending. Pause from their page if you'd rather not.", r.due_at, uid=str(r.id))

    # ---- customers -----------------------------------------------------------------------------------
    for c in customers.values():
        if c.consent_at and c.consent_at >= since and c.consent == "granted":
            add("joined", "customers", c, f"{c.display_name} joined WhatsApp updates",
                "They'll get entries to confirm and polite reminders with a pay link.", c.consent_at, uid="j")
        if c.created_at and c.created_at >= since:
            add("new_customer", "customers", c, f"New customer: {c.display_name}",
                "Added to your khata." + (" No WhatsApp yet." if c.consent != "granted" else ""), c.created_at, uid="n")

    items.sort(key=lambda i: (0 if i["category"] == "action" else 1, 0 if i["urgent"] else 1, i["at"]), reverse=False)
    # Actions first (urgent first), then events newest first.
    actions = [i for i in items if i["category"] == "action"]
    actions.sort(key=lambda i: (not i["urgent"], i["at"]), reverse=False)
    events = [i for i in items if i["category"] != "action"]
    events.sort(key=lambda i: i["at"], reverse=True)
    ordered = actions + events
    counts = {"action": len(actions)}
    for i in events:
        counts[i["category"]] = counts.get(i["category"], 0) + 1
    return {"items": ordered, "counts": counts, "now": _iso(now)}
