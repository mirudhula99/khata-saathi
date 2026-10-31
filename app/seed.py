"""Demo data: one shop, 20 customers, about two months of history.

Lakshmi starts with no dues so the live demo entry is clean. There are two
customers named Ramesh to show the "Which Ramesh?" question.
"""
import random
from datetime import timedelta

from sqlalchemy.orm import Session

from . import clock, ledger, payments
from .config import settings
from .db import SessionLocal, reset_db
from .i18n import customer_text, items_text
from .models import Customer, LedgerEntry, Merchant, Message, Reminder
from .resolver import name_key

# name, note, language, consent, payment habit, owes now (₹), oldest unpaid (days)
# Six customers owe ₹2,000 in total, three on each channel: Ramesh (Gandhi Street) ₹800 for 40 days, Fatima ₹260
# and Priya ₹180 on WhatsApp; Kumaran ₹320, Ravi ₹290 and Suresh ₹150 in the Paytm app. The live demo entry for
# Lakshmi starts from zero. Everyone else is settled but has history, so the khata looks lived-in and
# "What about Ravi?" has a repayment record to read out.
CUSTOMERS = [
    ("Lakshmi", "Gandhi Nagar", "en-IN", "granted", "fast", 0, 0),
    ("Ramesh", "Gandhi Street", "en-IN", "granted", "slow", 800, 40),
    ("Ramesh", "Teacher", "en-IN", "granted", "fast", 0, 0),
    ("Ravi", "", "en-IN", "granted", "normal", 290, 12),
    ("Suresh", "", "en-IN", "granted", "normal", 150, 5),
    ("Kumaran", "Bus stand", "en-IN", "granted", "normal", 320, 8),
    ("Priya", "", "en-IN", "granted", "normal", 180, 3),
    ("Arjun", "", "en-IN", "pending", "normal", 0, 0),
    ("Fatima", "", "en-IN", "granted", "fast", 260, 6),
    ("Meena", "", "en-IN", "granted", "fast", 0, 0),
    ("Venkatesh", "", "en-IN", "pending", "slow", 0, 0),
    ("Anitha", "", "en-IN", "granted", "fast", 0, 0),
    ("Deepa", "", "en-IN", "granted", "fast", 0, 0),
    ("Imran", "", "en-IN", "granted", "slow", 0, 0),
    ("Sowmya", "", "en-IN", "pending", "fast", 0, 0),
    ("Ganesh", "", "en-IN", "granted", "normal", 0, 0),
    ("Kavya", "", "en-IN", "granted", "fast", 0, 0),
    ("Rahul", "", "en-IN", "granted", "normal", 0, 0),
    ("Nandini", "", "en-IN", "opted_out", "slow", 0, 0),
    ("Joseph", "", "en-IN", "granted", "normal", 0, 0),
]
HABITS = {"fast": (2, 5), "normal": (5, 10), "slow": (12, 25)}
ITEMS = ["rice 5 kg", "toor dal 1 kg", "sugar 2 kg", "oil 1 L", "milk", "bread", "eggs 12", "soap", "tea powder",
         "atta 5 kg", "onions 2 kg", "biscuits"]
AMOUNTS = [80, 120, 150, 180, 200, 250, 300, 350, 400, 450, 500]


# Three customers on each channel get a short message history: the udhaar notes they confirmed, a receipt for each
# payment and, if they still owe, a reminder with a pay link. Lakshmi stays empty for the live demo entry.
PAYTM_CUSTOMERS = {"Ravi", "Suresh", "Kumaran"}
THREADS = {("Ravi", ""), ("Suresh", ""), ("Kumaran", "Bus stand"),            # Paytm app
           ("Ramesh", "Gandhi Street"), ("Priya", ""), ("Fatima", "")}     # WhatsApp


def _seed_messages(db: Session, merchant: Merchant, customer: Customer) -> None:
    lang = customer.language
    channel = "paytm" if customer.channel == "paytm" else settings.messaging_channel
    entries = sorted(db.query(LedgerEntry).filter(LedgerEntry.customer_id == customer.id).all(),
                     key=lambda e: e.created_at)

    def out(at, kind, body, buttons=None, link=None):
        db.add(Message(customer_id=customer.id, direction="out", channel=channel, kind=kind, body=body,
                       buttons=buttons or [], link_url=link, status="delivered", created_at=at))

    running = 0
    shown = entries[-3:]  # the latest three entries: enough to look lived-in, short enough to read on stage
    for e in entries:
        running += e.signed_paise
        if e not in shown:
            continue
        if e.type == "credit":
            body = customer_text(lang, "credit_note", shop=merchant.shop_name, amount=ledger.rupees(e.amount_paise),
                                 items=items_text(e.items), balance=ledger.rupees(running))
            out(e.created_at, "credit_note", f"{body}\n{customer_text(lang, 'footer')}",
                buttons=[{"id": f"ack:{e.id}", "title": customer_text(lang, "btn_ack")},
                         {"id": f"dispute:{e.id}", "title": customer_text(lang, "btn_dispute")}])
            db.add(Message(customer_id=customer.id, direction="in", channel=channel, kind="reply",
                           body=customer_text(lang, "btn_ack"), status="received",
                           created_at=e.created_at + timedelta(minutes=12)))
            e.customer_ack = "ack"
        elif e.type == "repayment":
            out(e.created_at, "receipt", customer_text(lang, "receipt", name=customer.display_name, shop=merchant.shop_name,
                                                       amount=ledger.rupees(e.amount_paise),
                                                       balance=ledger.rupees(max(running, 0))))
    if running > 0:  # still owes: one polite reminder yesterday, with a pay link
        # Inside the reminder gap, so a fresh demo has no "hasn't paid after a reminder" task yet; after
        # "Move time forward", it does.
        at = clock.now() - timedelta(days=1, hours=2)
        link = payments.create_link(db, merchant, customer, running)
        link.created_at = at
        body = customer_text(lang, "reminder_1", name=customer.display_name, shop=merchant.shop_name,
                             balance=ledger.rupees(running), link=link.url)
        from .services import reminder_buttons  # services imports nothing from seed, so this is safe here
        out(at, "reminder", f"{body}\n{customer_text(lang, 'footer')}", buttons=reminder_buttons(lang), link=link.url)
        db.add(Reminder(customer_id=customer.id, due_at=at, tone_level=1, status="sent", sent_at=at,
                        note="seeded"))


def _at(days_ago: float, rng: random.Random):
    return clock.now() - timedelta(days=days_ago, hours=rng.randint(0, 8), minutes=rng.randint(0, 59))


def seed(db: Session) -> Merchant:
    merchant = Merchant(shop_name=settings.shop_name, owner_name="", language=settings.merchant_language)
    db.add(merchant)
    db.flush()

    for idx, (name, note, lang, consent, habit, owes, age) in enumerate(CUSTOMERS, start=1):
        rng = random.Random(1000 + idx)
        customer = Customer(
            merchant_id=merchant.id, display_name=name, name_latin=name, name_key=name_key(name), note=note,
            language=lang,
            phone=f"+91 90000 1{idx:04d}", consent=consent,
            consent_at=clock.now() - timedelta(days=60) if consent != "pending" else None,
            created_at=clock.now() - timedelta(days=62),
        )
        # Demo: three customers get their messages inside the Paytm app, the rest on WhatsApp.
        customer.channel = "paytm" if name in PAYTM_CUSTOMERS else "whatsapp"
        db.add(customer)
        db.flush()

        # Older credits that were paid back, following the customer's habit.
        day = 60.0
        stop_at = (age + 4) if owes else 2
        low, high = HABITS[habit]
        while day > stop_at:
            amount = rng.choice(AMOUNTS)
            paid_day = day - rng.randint(low, high)
            if paid_day <= stop_at:
                break
            ledger.add_entry(db, merchant_id=merchant.id, customer_id=customer.id, type="credit",
                             amount_paise=amount * 100, items=[rng.choice(ITEMS)], source="seed",
                             created_at=_at(day, rng))
            ledger.add_entry(db, merchant_id=merchant.id, customer_id=customer.id, type="repayment",
                             amount_paise=amount * 100, source=rng.choice(["mock", "cash"]),
                             created_at=_at(paid_day, rng))
            day = paid_day - rng.randint(1, 6)

        # What they owe today.
        if owes:
            parts = [owes]
            if owes >= 300 and age >= 4:
                first = int(round(owes * 0.6 / 10) * 10)
                parts = [first, owes - first]
            days = [age, max(1, age - rng.randint(1, max(1, age // 2)))]
            for amount, ago in zip(parts, days):
                ledger.add_entry(db, merchant_id=merchant.id, customer_id=customer.id, type="credit",
                                 amount_paise=amount * 100, items=[rng.choice(ITEMS)], source="seed",
                                 created_at=clock.now() - timedelta(days=ago, hours=1))
            # Seeded dues get a scheduled reminder like real ones would, so "Move time forward" has something to send.
            if consent == "granted":
                db.add(Reminder(customer_id=customer.id, due_at=clock.now() + timedelta(days=1),
                                tone_level=1, status="scheduled", note="seeded"))

    # Message history for the six demo customers (three per channel), so both phone screens have something to show.
    db.flush()
    for customer in db.query(Customer).filter(Customer.merchant_id == merchant.id).all():
        if (customer.display_name, customer.note) in THREADS:
            _seed_messages(db, merchant, customer)

    # A few cash sales today for the daily summary.
    for amount, hours in ((120, 5), (340, 3), (85, 1)):
        ledger.add_entry(db, merchant_id=merchant.id, customer_id=None, type="cash_sale",
                         amount_paise=amount * 100, source="seed", created_at=clock.now() - timedelta(hours=hours))
    db.commit()
    return merchant


def reset_and_seed() -> None:
    clock.reset()
    reset_db()
    with SessionLocal() as db:
        seed(db)
