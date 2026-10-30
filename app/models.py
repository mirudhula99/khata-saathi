"""Database tables. Money is stored in paise (integers), never floats.

The ledger is append-only: corrections are new "reversal" rows.
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from . import clock
from .db import Base


class Merchant(Base):
    __tablename__ = "merchants"
    id: Mapped[int] = mapped_column(primary_key=True)
    shop_name: Mapped[str] = mapped_column(String(120))
    owner_name: Mapped[str] = mapped_column(String(120), default="")
    language: Mapped[str] = mapped_column(String(10), default="ta-IN")
    phone: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)


class Customer(Base):
    __tablename__ = "customers"
    id: Mapped[int] = mapped_column(primary_key=True)
    merchant_id: Mapped[int] = mapped_column(ForeignKey("merchants.id"), index=True)
    display_name: Mapped[str] = mapped_column(String(120))
    # The name in Latin script ("லட்சுமி" -> "Lakshmi"); name_key is built from it for matching.
    name_latin: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    name_key: Mapped[str] = mapped_column(String(120), index=True, default="")
    aliases: Mapped[list] = mapped_column(JSON, default=list)
    note: Mapped[str] = mapped_column(String(120), default="")
    phone: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    language: Mapped[str] = mapped_column(String(10), default="ta-IN")
    # pending | granted | opted_out
    consent: Mapped[str] = mapped_column(String(16), default="pending")
    consent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    reminders_paused: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now)


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"
    id: Mapped[int] = mapped_column(primary_key=True)
    merchant_id: Mapped[int] = mapped_column(ForeignKey("merchants.id"), index=True)
    customer_id: Mapped[Optional[int]] = mapped_column(ForeignKey("customers.id"), index=True, nullable=True)
    # credit | repayment | cash_sale | reversal
    type: Mapped[str] = mapped_column(String(16))
    amount_paise: Mapped[int] = mapped_column(Integer)
    # +credit, -repayment, 0 cash sale, reversal = minus the reversed entry
    signed_paise: Mapped[int] = mapped_column(Integer)
    items: Mapped[list] = mapped_column(JSON, default=list)
    # voice | cash | mock | paytm | manual | seed
    source: Mapped[str] = mapped_column(String(16), default="voice")
    # active | disputed (disputed credits are left out of the balance)
    status: Mapped[str] = mapped_column(String(16), default="active")
    # None | ack | disputed | kept
    customer_ack: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    reverses_entry_id: Mapped[Optional[int]] = mapped_column(ForeignKey("ledger_entries.id"), nullable=True)
    payment_id: Mapped[Optional[int]] = mapped_column(ForeignKey("payments.id"), nullable=True)
    transcript: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now, index=True)


class PendingAction(Base):
    """A parsed voice command waiting for the merchant's "yes"."""

    __tablename__ = "pending_actions"
    id: Mapped[int] = mapped_column(primary_key=True)
    merchant_id: Mapped[int] = mapped_column(ForeignKey("merchants.id"), index=True)
    # add_credit | record_repayment | cash_sale | request_payment
    kind: Mapped[str] = mapped_column(String(24))
    # awaiting_confirm | awaiting_choice | done | cancelled | expired
    state: Mapped[str] = mapped_column(String(20), default="awaiting_confirm")
    transcript: Mapped[str] = mapped_column(Text, default="")
    # {"amount": int|None, "items": [...], "payment_mode": str|None, "spoken_name": str|None}
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    customer_id: Mapped[Optional[int]] = mapped_column(ForeignKey("customers.id"), nullable=True)
    new_customer_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    options: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now)
    expires_at: Mapped[datetime] = mapped_column(DateTime)


class Reminder(Base):
    __tablename__ = "reminders"
    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)
    due_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    tone_level: Mapped[int] = mapped_column(Integer, default=1)
    # scheduled | sent | cancelled | skipped
    status: Mapped[str] = mapped_column(String(16), default="scheduled", index=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    note: Mapped[str] = mapped_column(String(120), default="")


class PaymentLink(Base):
    __tablename__ = "payment_links"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    merchant_id: Mapped[int] = mapped_column(ForeignKey("merchants.id"))
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)
    amount_paise: Mapped[int] = mapped_column(Integer)
    url: Mapped[str] = mapped_column(String(300), default="")
    # open | paid
    status: Mapped[str] = mapped_column(String(16), default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now)


class Payment(Base):
    __tablename__ = "payments"
    id: Mapped[int] = mapped_column(primary_key=True)
    provider: Mapped[str] = mapped_column(String(16))
    provider_payment_id: Mapped[str] = mapped_column(String(80), unique=True)
    link_id: Mapped[Optional[str]] = mapped_column(ForeignKey("payment_links.id"), nullable=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)
    amount_paise: Mapped[int] = mapped_column(Integer)
    verified_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now)
    raw_event: Mapped[dict] = mapped_column(JSON, default=dict)


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)
    direction: Mapped[str] = mapped_column(String(4))  # out | in
    channel: Mapped[str] = mapped_column(String(16))
    # credit_note | reminder | payment_request | receipt | notice | reply
    kind: Mapped[str] = mapped_column(String(24))
    body: Mapped[str] = mapped_column(Text, default="")
    buttons: Mapped[list] = mapped_column(JSON, default=list)
    link_url: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="queued")
    provider_message_id: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=clock.now, index=True)
