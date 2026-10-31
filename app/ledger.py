"""Ledger maths. All amounts are computed here in code, never by the LLM."""
from collections import deque
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import clock
from .models import Customer, LedgerEntry

SIGN = {"credit": 1, "repayment": -1, "cash_sale": 0}


def rupees(paise: int) -> int:
    return int(round((paise or 0) / 100))


def add_entry(db: Session, *, merchant_id: int, customer_id: int | None, type: str, amount_paise: int,
              items: list | None = None, source: str = "voice", transcript: str | None = None,
              payment_id: int | None = None, created_at: datetime | None = None) -> LedgerEntry:
    if amount_paise <= 0:
        raise ValueError("Amount must be positive.")
    entry = LedgerEntry(
        merchant_id=merchant_id, customer_id=customer_id, type=type, amount_paise=amount_paise,
        signed_paise=SIGN[type] * amount_paise, items=items or [], source=source, status="active",
        transcript=transcript, payment_id=payment_id, created_at=created_at or clock.now(),
    )
    db.add(entry)
    db.flush()
    return entry


def reverse_entry(db: Session, entry: LedgerEntry, source: str = "manual") -> LedgerEntry:
    """Cancel an entry by adding its opposite. History is never edited away."""
    reversal = LedgerEntry(
        merchant_id=entry.merchant_id, customer_id=entry.customer_id, type="reversal",
        amount_paise=entry.amount_paise, signed_paise=-entry.signed_paise, items=[], source=source,
        status="active", reverses_entry_id=entry.id, created_at=clock.now(),
    )
    db.add(reversal)
    db.flush()
    return reversal


def adjust_balance(db: Session, customer: Customer, target_paise: int) -> LedgerEntry | None:
    """The merchant corrects what a customer owes. History is never edited: the difference is added as an
    "adjustment" row (+ owes more, - owes less), so the old entries and the correction both stay visible."""
    delta = target_paise - balance_paise(db, customer.id)
    if delta == 0:
        return None
    entry = LedgerEntry(
        merchant_id=customer.merchant_id, customer_id=customer.id, type="adjustment", amount_paise=abs(delta),
        signed_paise=delta, items=[], source="manual", status="active", created_at=clock.now(),
    )
    db.add(entry)
    db.flush()
    return entry


def balance_paise(db: Session, customer_id: int) -> int:
    total = db.scalar(
        select(func.coalesce(func.sum(LedgerEntry.signed_paise), 0))
        .where(LedgerEntry.customer_id == customer_id, LedgerEntry.status == "active")
    )
    return int(total or 0)


def balances(db: Session, merchant_id: int) -> dict[int, int]:
    rows = db.execute(
        select(LedgerEntry.customer_id, func.sum(LedgerEntry.signed_paise))
        .where(LedgerEntry.merchant_id == merchant_id, LedgerEntry.customer_id.is_not(None),
               LedgerEntry.status == "active")
        .group_by(LedgerEntry.customer_id)
    ).all()
    return {cid: int(total or 0) for cid, total in rows}


def history(db: Session, customer_id: int, limit: int | None = None) -> list[LedgerEntry]:
    query = select(LedgerEntry).where(LedgerEntry.customer_id == customer_id).order_by(LedgerEntry.created_at.desc())
    if limit:
        query = query.limit(limit)
    return list(db.scalars(query).all())


def fifo_stats(entries: list[LedgerEntry]) -> dict:
    """Match repayments to the oldest credits first.

    Returns how long the oldest unpaid credit has waited and how many days the
    customer usually takes to clear a credit.
    """
    open_credits: deque = deque()  # [remaining_paise, created_at]
    cleared_days: list[int] = []
    for entry in sorted(entries, key=lambda e: e.created_at):
        if entry.status != "active" or entry.signed_paise == 0:
            continue
        if entry.signed_paise > 0:
            open_credits.append([entry.signed_paise, entry.created_at])
            continue
        remaining = -entry.signed_paise
        while remaining > 0 and open_credits:
            head = open_credits[0]
            used = min(head[0], remaining)
            head[0] -= used
            remaining -= used
            if head[0] == 0:
                cleared_days.append(max(0, (entry.created_at - head[1]).days))
                open_credits.popleft()
    oldest = open_credits[0][1] if open_credits else None
    return {
        "oldest_unpaid_days": clock.days_since(oldest) if oldest else 0,
        "avg_days_to_clear": round(sum(cleared_days) / len(cleared_days), 1) if cleared_days else None,
        "credits_cleared": len(cleared_days),
    }


def customer_stats(db: Session, customer: Customer) -> dict:
    entries = history(db, customer.id)
    stats = fifo_stats(entries)
    repayments = [e for e in entries if e.type == "repayment" and e.status == "active"]
    stats.update({
        "balance": rupees(balance_paise(db, customer.id)),
        "last_payment_days_ago": clock.days_since(repayments[0].created_at) if repayments else None,
        "credits_count": sum(1 for e in entries if e.type == "credit"),
        "repayments_count": len(repayments),
    })
    return stats


def outstanding(db: Session, merchant_id: int) -> list[dict]:
    owed = {cid: bal for cid, bal in balances(db, merchant_id).items() if bal > 0}
    if not owed:
        return []
    customers = db.scalars(select(Customer).where(Customer.id.in_(owed.keys()))).all()
    rows = []
    for customer in customers:
        stats = fifo_stats(history(db, customer.id))
        rows.append({"customer_id": customer.id, "name": customer.display_name, "note": customer.note,
                     "balance": rupees(owed[customer.id]), "days": stats["oldest_unpaid_days"]})
    rows.sort(key=lambda r: -r["balance"])
    return rows


def weekly_summary(db: Session, merchant_id: int, days: int = 7) -> dict:
    """Per-day totals for the home-screen chart: udhaar given vs money received, last `days` IST days ending today.

    Read-only. Follows the demo clock (clock.now), so "Move time forward" shifts the window too.
    Active entries only (disputed credits stay out, reversals are ignored). Rupees, not paise.
    """
    today = clock.ist_today()
    buckets: dict = {}
    for i in range(days - 1, -1, -1):
        d = today - timedelta(days=i)
        buckets[d] = {"date": d.isoformat(), "label": d.strftime("%a"), "given": 0, "received": 0}
    entries = db.scalars(
        select(LedgerEntry).where(LedgerEntry.merchant_id == merchant_id, LedgerEntry.status == "active")
        .where(LedgerEntry.created_at >= clock.now() - timedelta(days=days + 1))
    ).all()
    for entry in entries:
        bucket = buckets.get(clock.to_ist(entry.created_at).date())
        if bucket is None:
            continue
        if entry.type == "credit":
            bucket["given"] += entry.amount_paise
        elif entry.type == "repayment":
            bucket["received"] += entry.amount_paise
    rows = [{**b, "given": rupees(b["given"]), "received": rupees(b["received"])} for b in buckets.values()]
    return {"days": rows, "given": sum(r["given"] for r in rows), "received": sum(r["received"] for r in rows)}


def today_summary(db: Session, merchant_id: int) -> dict:
    today = clock.ist_today()
    entries = db.scalars(
        select(LedgerEntry).where(LedgerEntry.merchant_id == merchant_id, LedgerEntry.status == "active")
        .where(LedgerEntry.created_at >= clock.now() - timedelta(days=2))
    ).all()
    sums = {"sales": 0, "given": 0, "collected": 0}
    for entry in entries:
        if clock.to_ist(entry.created_at).date() != today:
            continue
        if entry.type == "cash_sale":
            sums["sales"] += entry.amount_paise
        elif entry.type == "credit":
            sums["given"] += entry.amount_paise
        elif entry.type == "repayment":
            sums["collected"] += entry.amount_paise
    return {k: rupees(v) for k, v in sums.items()}
