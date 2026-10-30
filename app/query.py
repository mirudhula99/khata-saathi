"""Answer questions like "Who owes me money?".

The LLM may only call these read-only tools; it never writes to the ledger.
Without an LLM, a simple fallback answers the common questions.
"""
import json
import logging
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import clock, ledger, sarvam
from .config import settings
from .i18n import LANGUAGES, money, say
from .models import Customer, Merchant
from .resolver import resolve
from .understand import match_known_name

log = logging.getLogger("khata.query")

TOOLS = [
    {"type": "function", "function": {
        "name": "get_outstanding_list",
        "description": "Customers who owe money, with balance in rupees and days the oldest credit has been pending.",
        "parameters": {"type": "object", "properties": {
            "sort_by": {"type": "string", "enum": ["amount", "oldest"]},
            "limit": {"type": "integer"}}, "required": []}}},
    {"type": "function", "function": {
        "name": "get_customer_balance",
        "description": "How much one customer owes in rupees, how many days the oldest credit has waited, "
                       "and their repayment habits. Looked up by name.",
        "parameters": {"type": "object", "properties": {"name": {"type": "string"}}, "required": ["name"]}}},
    {"type": "function", "function": {
        "name": "get_customer_history",
        "description": "One customer's recent ledger entries (credits, repayments, reversals), newest first.",
        "parameters": {"type": "object", "properties": {
            "name": {"type": "string"},
            "limit": {"type": "integer"}}, "required": ["name"]}}},
    {"type": "function", "function": {
        "name": "get_today_summary",
        "description": "Today's cash sales, udhaar given and money collected, in rupees.",
        "parameters": {"type": "object", "properties": {}, "required": []}}},
]

TODAY_WORDS = {"today", "aaj", "indru", "inniki", "ivattu", "eeroju", "ivaththu"}


def _customer_balance(db: Session, customer: Customer) -> dict:
    stats = ledger.customer_stats(db, customer)
    return {"name": customer.display_name, "note": customer.note, **stats}


def _customer_history(db: Session, customer: Customer, limit: int) -> dict:
    entries = [{"type": e.type, "amount": ledger.rupees(e.amount_paise), "items": e.items or [],
                "source": e.source, "status": e.status, "date": clock.to_ist(e.created_at).date().isoformat()}
               for e in ledger.history(db, customer.id, limit=limit)]
    return {"name": customer.display_name, "note": customer.note,
            "balance": ledger.rupees(ledger.balance_paise(db, customer.id)), "entries": entries}


def _for_customer(db: Session, merchant: Merchant, spoken_name: str, describe) -> dict:
    res = resolve(db, merchant.id, spoken_name)
    if res.kind == "match":
        return describe(res.customer)
    if res.kind == "choose":
        return {"matches": [describe(c) for c in res.options]}
    return {"error": "No customer with that name."}


def run_tool(db: Session, merchant: Merchant, name: str, args: dict) -> dict:
    if name == "get_outstanding_list":
        rows = ledger.outstanding(db, merchant.id)
        if args.get("sort_by") == "oldest":
            rows.sort(key=lambda r: -r["days"])
        limit = max(1, min(int(args.get("limit") or 10), 25))
        return {"total_owed": sum(r["balance"] for r in rows), "customers_owing": len(rows), "top": rows[:limit]}
    if name == "get_customer_balance":
        return _for_customer(db, merchant, args.get("name", ""), lambda c: _customer_balance(db, c))
    if name == "get_customer_history":
        limit = max(1, min(int(args.get("limit") or 10), 30))
        return _for_customer(db, merchant, args.get("name", ""), lambda c: _customer_history(db, c, limit))
    if name == "get_today_summary":
        return ledger.today_summary(db, merchant.id)
    return {"error": f"Unknown tool {name}"}


def _llm_answer(db: Session, merchant: Merchant, question: str, lang: str) -> str:
    system = (
        f"You are Khata Saathi, a ledger assistant for a small Indian shop. Answer in {LANGUAGES.get(lang, 'English')} "
        "in one or two short spoken sentences (under 40 words). Use the tools for every number and repeat numbers "
        "exactly as the tools return them. Amounts are in rupees. oldest_unpaid_days 0 means the credit is "
        "from today. Do not use markdown."
    )
    messages = [{"role": "system", "content": system}, {"role": "user", "content": question}]
    for _ in range(3):
        message = sarvam.llm_chat(messages, model=settings.query_llm_model, tools=TOOLS, max_tokens=400)
        calls = message.get("tool_calls") or []
        if not calls:
            text = sarvam.strip_think(message.get("content") or "")
            if text:
                return text
            break
        messages.append({"role": "assistant", "content": message.get("content") or "", "tool_calls": calls})
        for call in calls:
            fn = call.get("function", {})
            try:
                args = json.loads(fn.get("arguments") or "{}")
            except json.JSONDecodeError:
                args = {}
            result = run_tool(db, merchant, fn.get("name", ""), args)
            messages.append({"role": "tool", "tool_call_id": call.get("id", ""), "content": json.dumps(result)})
    raise sarvam.SarvamError("LLM gave no answer.")


def fallback_answer(db: Session, merchant: Merchant, question: str, lang: str, spoken: bool) -> str:
    names = [c.display_name for c in db.scalars(select(Customer).where(Customer.merchant_id == merchant.id))]
    name = match_known_name(question, names)
    if name:
        res = resolve(db, merchant.id, name)
        customer = res.customer or (res.options[0] if res.options else None)
        if customer:
            stats = ledger.customer_stats(db, customer)
            if stats["balance"] <= 0:
                return say(lang, "customer_clear", spoken, name=customer.display_name)
            if stats["oldest_unpaid_days"]:
                return say(lang, "customer_balance_days", spoken, name=customer.display_name,
                           balance=stats["balance"], days=stats["oldest_unpaid_days"])
            return say(lang, "customer_balance", spoken, name=customer.display_name, balance=stats["balance"])
    words = set(re.findall(r"\w+", question.lower()))
    if words & TODAY_WORDS:
        return say(lang, "today_summary", spoken, **ledger.today_summary(db, merchant.id))
    rows = ledger.outstanding(db, merchant.id)
    if not rows:
        return say(lang, "nobody", spoken)
    # The biggest balance also says how long it has waited ("Ramesh ₹800 for 40 days"), matching the pitch line.
    top = ", ".join(
        f"{r['name']} {money(r['balance'], lang, spoken)}" + (f" for {r['days']} days" if i == 0 and r.get("days") else "")
        for i, r in enumerate(rows[:3]))
    return say(lang, "outstanding", spoken, count=len(rows), total=sum(r["balance"] for r in rows), top=top)


def answer(db: Session, merchant: Merchant, question: str, lang: str) -> tuple[str, str]:
    """Returns (text to show, text to speak)."""
    if settings.llm_enabled:
        try:
            text = _llm_answer(db, merchant, question, lang)
            return text, text
        except Exception as exc:
            log.warning("LLM answer failed, using fallback: %s", exc)
    return (fallback_answer(db, merchant, question, lang, spoken=False),
            fallback_answer(db, merchant, question, lang, spoken=True))
