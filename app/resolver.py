"""Match a spoken name ("Laxmi", "லட்சுமி") to a saved customer ("Lakshmi").

Rules: one strong match -> use it; several strong matches (two Rameshes)
or only weak matches -> ask the merchant; no match -> new customer.
"""
import re
import unicodedata
from dataclasses import dataclass, field

from rapidfuzz import fuzz
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import sarvam
from .models import Customer

STRONG = 88
WEAK = 72

# Spelling variants common in Indian names written in English.
_REPLACEMENTS = [
    ("ksh", "x"), ("sh", "s"), ("th", "t"), ("dh", "d"), ("bh", "b"), ("ph", "f"),
    ("kh", "k"), ("gh", "g"), ("ch", "c"), ("w", "v"), ("z", "j"), ("q", "k"),
    ("ee", "i"), ("oo", "u"), ("aa", "a"), ("ii", "i"), ("uu", "u"), ("y", "i"),
]


def name_key(name: str) -> str:
    raw = (name or "").strip()
    if not raw:
        return ""
    text = raw if raw.isascii() else sarvam.transliterate_to_latin(raw)
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    key = re.sub(r"[^a-z]", "", ascii_text)
    if not key:  # transliteration unavailable: compare the original script
        return raw.lower()
    for old, new in _REPLACEMENTS:
        key = key.replace(old, new)
    return re.sub(r"(.)\1+", r"\1", key)


def display_name(spoken: str) -> str:
    raw = (spoken or "").strip()
    if raw and not raw.isascii():
        raw = sarvam.transliterate_to_latin(raw)
    return " ".join(part.capitalize() for part in raw.split()) or "Customer"


def similarity(a_key: str, b_key: str) -> float:
    if not a_key or not b_key:
        return 0.0
    return fuzz.ratio(a_key, b_key)


@dataclass
class Resolution:
    kind: str  # match | choose | new
    customer: Customer | None = None
    options: list[Customer] = field(default_factory=list)


def resolve(db: Session, merchant_id: int, spoken_name: str) -> Resolution:
    key = name_key(spoken_name)
    customers = db.scalars(select(Customer).where(Customer.merchant_id == merchant_id)).all()
    scored = []
    for customer in customers:
        keys = [customer.name_key] + [name_key(alias) for alias in (customer.aliases or [])]
        scored.append((max(similarity(key, k) for k in keys), customer))
    scored.sort(key=lambda pair: -pair[0])

    strong = [c for score, c in scored if score >= STRONG]
    if len(strong) == 1:
        return Resolution("match", customer=strong[0])
    if len(strong) > 1:
        return Resolution("choose", options=strong[:4])
    weak = [c for score, c in scored if score >= WEAK][:3]
    if weak:
        return Resolution("choose", options=weak)
    return Resolution("new")
