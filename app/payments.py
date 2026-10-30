"""Payment links and payment confirmation.

Only a verified server-to-server event updates the ledger. A customer
opening the link, or a browser "success" page, proves nothing.

PaymentProvider is an interface: MockProvider works today; fill in
PaytmProvider if you get Paytm sandbox access at the event.
"""
import hashlib
import hmac
import json
import logging
import secrets

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import clock, ledger
from .config import settings
from .models import Customer, Merchant, Payment, PaymentLink

log = logging.getLogger("khata.payments")


class PaymentVerificationError(Exception):
    pass


class PaymentProvider:
    name = "base"

    def create_link(self, link: PaymentLink) -> str:
        raise NotImplementedError

    def verify_and_parse(self, raw_body: bytes, headers: dict) -> dict:
        """Return {"payment_id", "link_id", "amount_paise", "status"} or raise."""
        raise NotImplementedError


class MockProvider(PaymentProvider):
    """Hosts its own payment page at /pay/<link_id> and signs events with HMAC.

    It goes through the exact same verification and ledger code a real
    provider would, so swapping in Paytm later changes only this class.
    """

    name = "mock"

    def create_link(self, link: PaymentLink) -> str:
        return f"{settings.public_base_url}/pay/{link.id}"

    def sign(self, raw_body: bytes) -> str:
        return hmac.new(settings.payment_webhook_secret.encode(), raw_body, hashlib.sha256).hexdigest()

    def verify_and_parse(self, raw_body: bytes, headers: dict) -> dict:
        signature = headers.get("x-khata-signature", "")
        if not hmac.compare_digest(signature, self.sign(raw_body)):
            raise PaymentVerificationError("Signature check failed.")
        event = json.loads(raw_body)
        for key in ("payment_id", "link_id", "amount_paise", "status"):
            if key not in event:
                raise PaymentVerificationError(f"Missing field: {key}")
        return event


class PaytmProvider(PaymentProvider):
    """Placeholder. Implement with the Paytm sandbox credentials and docs
    the organisers provide; keep the same return shapes as MockProvider."""

    name = "paytm"

    def create_link(self, link: PaymentLink) -> str:
        raise NotImplementedError("Add the Paytm sandbox payment-link call here.")

    def verify_and_parse(self, raw_body: bytes, headers: dict) -> dict:
        raise NotImplementedError("Verify Paytm's checksum/signature here before trusting the event.")


def get_provider() -> PaymentProvider:
    return PaytmProvider() if settings.payment_provider == "paytm" else MockProvider()


def create_link(db: Session, merchant: Merchant, customer: Customer, amount_paise: int) -> PaymentLink:
    link = PaymentLink(id=secrets.token_urlsafe(8), merchant_id=merchant.id, customer_id=customer.id,
                       amount_paise=amount_paise, status="open", created_at=clock.now())
    link.url = get_provider().create_link(link)
    db.add(link)
    db.flush()
    return link


def build_mock_event(link: PaymentLink, amount_paise: int) -> tuple[bytes, dict]:
    """Used by the mock payment page: builds a signed event like a real provider would send."""
    provider = MockProvider()
    event = {"payment_id": f"MOCK_{secrets.token_hex(6)}", "link_id": link.id, "amount_paise": amount_paise,
             "status": "SUCCESS", "sent_at": clock.now().isoformat()}
    raw = json.dumps(event, separators=(",", ":")).encode()
    return raw, {"x-khata-signature": provider.sign(raw)}


def record_verified_payment(db: Session, raw_body: bytes, headers: dict) -> dict:
    """Verify, de-duplicate and write a repayment entry.

    Returns {"status": "recorded" | "duplicate" | "ignored", ...}. The caller
    runs the follow-up (receipt, reminders, merchant alert) for "recorded".
    """
    provider = get_provider()
    event = provider.verify_and_parse(raw_body, {k.lower(): v for k, v in headers.items()})
    if str(event.get("status")).upper() != "SUCCESS":
        return {"status": "ignored", "reason": f"status {event.get('status')}"}

    existing = db.scalar(select(Payment).where(Payment.provider_payment_id == event["payment_id"]))
    if existing:
        return {"status": "duplicate", "payment_id": existing.id}

    link = db.get(PaymentLink, event["link_id"])
    if link is None:
        raise PaymentVerificationError("Unknown payment link.")
    amount_paise = int(event["amount_paise"])
    if amount_paise <= 0:
        raise PaymentVerificationError("Amount must be positive.")
    # The money has really arrived, so it is always recorded (refusing would hide it from the khata).
    # A real provider should make links single-use and fixed-amount; these warnings show when it didn't.
    if link.status == "paid":
        log.warning("Payment %s arrived on link %s, which was already paid.", event["payment_id"], link.id)
    balance = ledger.balance_paise(db, link.customer_id)
    if amount_paise > balance:
        log.warning("Payment %s of %s paise is more than customer %s owes (%s paise); the balance goes negative.",
                    event["payment_id"], amount_paise, link.customer_id, balance)

    payment = Payment(provider=provider.name, provider_payment_id=event["payment_id"], link_id=link.id,
                      customer_id=link.customer_id, amount_paise=amount_paise, verified_at=clock.now(),
                      raw_event=event)
    db.add(payment)
    try:
        db.flush()
    except IntegrityError:  # the same event arrived twice at the same moment
        db.rollback()
        return {"status": "duplicate"}
    entry = ledger.add_entry(db, merchant_id=link.merchant_id, customer_id=link.customer_id, type="repayment",
                             amount_paise=amount_paise, source=provider.name, payment_id=payment.id)
    link.status = "paid"
    db.commit()
    log.info("Payment %s recorded: %s paise from customer %s", payment.provider_payment_id, amount_paise,
             link.customer_id)
    return {"status": "recorded", "payment_id": payment.id, "entry_id": entry.id,
            "customer_id": link.customer_id, "amount_paise": amount_paise}
