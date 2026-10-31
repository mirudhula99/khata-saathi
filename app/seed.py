"""Demo data: one shop, 20 customers, about two months of history.

Lakshmi starts with no dues so the live demo entry is clean. There are two
customers named Ramesh to show the "Which Ramesh?" question.
"""
import random
from datetime import timedelta

from sqlalchemy.orm import Session

from . import clock, ledger
from .config import settings
from .db import SessionLocal, reset_db
from .models import Customer, Merchant, Reminder
from .resolver import name_key

# name, note, language, consent, payment habit, owes now (₹), oldest unpaid (days)
# Matches the pitch deck (slide 3): exactly 3 customers owe ₹1,240 in total,
# Ramesh owes ₹800 for 40 days, and the live demo entry for Lakshmi starts from zero.
# Everyone else is settled but has history, so the khata looks lived-in and
# "What about Ravi?" has a repayment record to read out.
CUSTOMERS = [
    ("Lakshmi", "Gandhi Nagar", "en-IN", "granted", "fast", 0, 0),
    ("Ramesh", "Gandhi Street", "en-IN", "granted", "slow", 800, 40),
    ("Ramesh", "Teacher", "en-IN", "granted", "fast", 0, 0),
    ("Ravi", "", "en-IN", "granted", "normal", 290, 12),
    ("Suresh", "", "en-IN", "granted", "normal", 150, 5),
    ("Kumaran", "Bus stand", "en-IN", "granted", "normal", 0, 0),
    ("Priya", "", "en-IN", "granted", "normal", 0, 0),
    ("Arjun", "", "en-IN", "pending", "normal", 0, 0),
    ("Fatima", "", "en-IN", "granted", "fast", 0, 0),
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
        # Demo: Ravi gets his reminders inside the Paytm app; everyone else on WhatsApp.
        customer.channel = "paytm" if name == "Ravi" else "whatsapp"
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
