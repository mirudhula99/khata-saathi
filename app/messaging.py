"""Send messages to customers.

Every message is stored in the database, so the customer-phone simulator
(/customer) always shows it, even when WhatsApp is switched on. That gives
you a backup screen if WhatsApp misbehaves during the demo.

WhatsApp note: free-form and button messages only reach a number that has
messaged your business in the last 24 hours. For the demo, have each test
phone send "hi" to your WhatsApp test number shortly before you present.
Outside that window WhatsApp requires pre-approved templates.
"""
import hashlib
import hmac
import logging
import re

import httpx
from sqlalchemy.orm import Session

from .config import settings
from .events import bus
from .models import Customer, Message

log = logging.getLogger("khata.messaging")


def phone_digits(phone: str | None) -> str:
    digits = re.sub(r"\D", "", phone or "")
    if len(digits) == 10:
        digits = "91" + digits
    return digits


def message_dict(msg: Message) -> dict:
    return {
        "id": msg.id, "direction": msg.direction, "channel": msg.channel, "kind": msg.kind, "body": msg.body,
        "buttons": msg.buttons or [], "link_url": msg.link_url, "status": msg.status,
        "created_at": msg.created_at.isoformat() + "Z",
    }


def send(db: Session, customer: Customer, *, kind: str, body: str, buttons: list | None = None,
         link_url: str | None = None) -> Message:
    msg = Message(customer_id=customer.id, direction="out", channel=settings.messaging_channel, kind=kind,
                  body=body, buttons=buttons or [], link_url=link_url, status="queued")
    db.add(msg)
    db.flush()
    if settings.messaging_channel == "whatsapp":
        if not customer.phone:
            msg.status = "no_phone"
        else:
            try:
                msg.provider_message_id = _send_whatsapp(customer.phone, body, buttons or [])
                msg.status = "sent"
            except Exception as exc:
                log.warning("WhatsApp send failed for customer %s: %s", customer.id, exc)
                msg.status = "failed"
    else:
        msg.status = "delivered"
    db.commit()
    bus.publish(f"customer:{customer.id}", {"type": "message", "message": message_dict(msg)})
    return msg


def log_incoming(db: Session, customer: Customer, body: str, channel: str) -> Message:
    msg = Message(customer_id=customer.id, direction="in", channel=channel, kind="reply", body=body,
                  status="received")
    db.add(msg)
    db.flush()
    bus.publish(f"customer:{customer.id}", {"type": "message", "message": message_dict(msg)})
    return msg


def _send_whatsapp(phone: str, body: str, buttons: list) -> str:
    if not (settings.whatsapp_token and settings.whatsapp_phone_number_id):
        raise RuntimeError("WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID are not set.")
    url = f"https://graph.facebook.com/{settings.whatsapp_api_version}/{settings.whatsapp_phone_number_id}/messages"
    to = phone_digits(phone)
    if buttons:
        payload = {
            "messaging_product": "whatsapp", "to": to, "type": "interactive",
            "interactive": {
                "type": "button",
                "body": {"text": body[:1024]},
                "action": {"buttons": [
                    {"type": "reply", "reply": {"id": b["id"][:256], "title": b["title"][:20]}} for b in buttons[:3]
                ]},
            },
        }
    else:
        payload = {"messaging_product": "whatsapp", "to": to, "type": "text",
                   "text": {"body": body[:4096], "preview_url": True}}
    response = httpx.post(url, headers={"Authorization": f"Bearer {settings.whatsapp_token}"}, json=payload,
                          timeout=settings.http_timeout)
    if response.status_code >= 400:
        raise RuntimeError(f"WhatsApp API {response.status_code}: {response.text[:300]}")
    return response.json().get("messages", [{}])[0].get("id", "")


def verify_whatsapp_signature(raw_body: bytes, signature_header: str | None) -> bool:
    """Checks X-Hub-Signature-256 when WHATSAPP_APP_SECRET is set."""
    if not settings.whatsapp_app_secret:
        return True
    expected = "sha256=" + hmac.new(settings.whatsapp_app_secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header or "")


def parse_whatsapp_webhook(payload: dict) -> list[dict]:
    """Returns [{"phone": "...", "button_id": "...", "text": "..."}]."""
    out = []
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            for message in change.get("value", {}).get("messages", []) or []:
                item = {"phone": message.get("from", ""), "button_id": None, "text": None}
                kind = message.get("type")
                if kind == "interactive":
                    reply = message.get("interactive", {}).get("button_reply", {})
                    item["button_id"], item["text"] = reply.get("id"), reply.get("title")
                elif kind == "button":
                    item["button_id"] = message.get("button", {}).get("payload")
                    item["text"] = message.get("button", {}).get("text")
                elif kind == "text":
                    item["text"] = message.get("text", {}).get("body")
                out.append(item)
    return out
