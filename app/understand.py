"""Transcript -> structured command.

The LLM only interprets. Plain code validates the result, and the merchant
confirms before anything is saved. If the LLM is unavailable, a simple
rule-based parser keeps typed demos working.
"""
import json
import logging
import re
from typing import Literal, Optional

from pydantic import BaseModel, Field, ValidationError, field_validator
from rapidfuzz import fuzz

from . import sarvam
from .config import settings
from .resolver import name_key

log = logging.getLogger("khata.understand")

Intent = Literal[
    "add_credit", "record_repayment", "cash_sale", "request_payment",
    "query", "confirm", "reject", "correct", "unknown",
]


class ParsedCommand(BaseModel):
    intent: Intent = "unknown"
    customer_name: Optional[str] = None
    amount: Optional[int] = None
    items: list[str] = Field(default_factory=list)
    payment_mode: Optional[Literal["cash", "paytm"]] = None
    question: Optional[str] = None
    needs_clarification: bool = False
    source: str = "llm"
    warning: Optional[str] = None

    @field_validator("amount", mode="before")
    @classmethod
    def _amount(cls, v):
        if v in (None, ""):
            return None
        if isinstance(v, str):
            digits = re.sub(r"[^\d]", "", v)
            return int(digits) if digits else None
        if isinstance(v, float):
            return int(round(v))
        return v

    @field_validator("customer_name", "question", mode="before")
    @classmethod
    def _blank(cls, v):
        if v is None:
            return None
        v = str(v).strip()
        return v or None

    @field_validator("payment_mode", mode="before")
    @classmethod
    def _mode(cls, v):
        v = (str(v).strip().lower() if v else "")
        return v if v in ("cash", "paytm") else None

    @field_validator("items", mode="before")
    @classmethod
    def _items(cls, v):
        if not v:
            return []
        if isinstance(v, str):
            return [v]
        return [str(i).strip() for i in v if str(i).strip()]


# ------------------------------------------------------------------ LLM prompt
SYSTEM_PROMPT = """You turn a small Indian shopkeeper's spoken command into JSON for a credit ledger (khata).
The shopkeeper may speak Hindi, Kannada, Tamil, Telugu, English, or a mix written in any script.

Intents:
- add_credit: customer takes goods on credit (udhaar / kadan / saala / appu).
- record_repayment: customer paid back money (paid / diya / kuduthaar / kottaru / ichadu).
- cash_sale: a cash sale with no customer credit.
- request_payment: send a customer a payment link or reminder ("ask Kumaran for 500", "remind Ramesh").
- query: a question about the ledger ("who owes me money?", "how much does Ravi owe?").
- confirm: yes / haan / aamaa / houdu / avunu / sari / ok.
- reject: no / nahi / illa / beda / vaddu / cancel.
- correct: the shopkeeper corrects the amount of the waiting entry ("no, 180").
- unknown: anything else.

Rules:
- amount: whole rupees as an integer. Never guess. If no amount was said, use null.
- customer_name: Latin script, as spoken. If it clearly matches a known customer, use that spelling.
- items: short English names with quantity, e.g. "rice 2 kg". Never put the amount in items.
- payment_mode: "cash" or "paytm" only if said, else null.
- question: the original question text for query, else null.
- needs_clarification: true if you cannot tell the intent, the customer or the amount for sure
  (for example two numbers and it is unclear which is the amount). The shopkeeper will be asked to repeat.

Examples:
"Lakshmi ku 150 rupees udhaar, 2 kg rice" -> {"intent":"add_credit","customer_name":"Lakshmi","amount":150,"items":["rice 2 kg"],"payment_mode":null,"question":null,"needs_clarification":false}
"Ramesh 300 cash kuduthaaru" -> {"intent":"record_repayment","customer_name":"Ramesh","amount":300,"items":[],"payment_mode":"cash","question":null,"needs_clarification":false}
"राजू को 200 उधार" -> {"intent":"add_credit","customer_name":"Raju","amount":200,"items":[],"payment_mode":null,"question":null,"needs_clarification":false}
"Kumaran ge 500 saala" -> {"intent":"add_credit","customer_name":"Kumaran","amount":500,"items":[],"payment_mode":null,"question":null,"needs_clarification":false}
"Suresh 400 ichadu" -> {"intent":"record_repayment","customer_name":"Suresh","amount":400,"items":[],"payment_mode":null,"question":null,"needs_clarification":false}
"Ask Kumaran for 500" -> {"intent":"request_payment","customer_name":"Kumaran","amount":500,"items":[],"payment_mode":null,"question":null,"needs_clarification":false}
"Who owes me money?" -> {"intent":"query","customer_name":null,"amount":null,"items":[],"payment_mode":null,"question":"Who owes me money?","needs_clarification":false}
Return only the JSON object."""

RESPONSE_FORMAT = {
    "type": "json_schema",
    "json_schema": {
        "name": "khata_command",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "intent": {"type": "string", "enum": [
                    "add_credit", "record_repayment", "cash_sale", "request_payment",
                    "query", "confirm", "reject", "correct", "unknown"]},
                "customer_name": {"type": ["string", "null"]},
                "amount": {"type": ["integer", "null"]},
                "items": {"type": "array", "items": {"type": "string"}},
                "payment_mode": {"type": ["string", "null"], "enum": ["cash", "paytm", None]},
                "question": {"type": ["string", "null"]},
                "needs_clarification": {"type": "boolean"},
            },
            "required": ["intent", "customer_name", "amount", "items", "payment_mode", "question",
                         "needs_clarification"],
            "additionalProperties": False,
        },
    },
}

# ------------------------------------------------------------------ word lists
YES = {"yes", "yeah", "yep", "ok", "okay", "haan", "han", "haa", "ha", "ji", "theek", "thik", "sahi", "save",
       "aamaa", "aama", "amam", "sari", "seri", "houdu", "haudu", "avunu", "avnu", "sare", "confirm", "done",
       "correct", "हाँ", "हां", "ठीक", "ஆமா", "ஆமாம்", "சரி", "ಹೌದು", "ಸರಿ", "అవును", "సరే"}
NO = {"no", "nope", "nahi", "nahin", "na", "illa", "illai", "vendam", "venda", "beda", "vaddu", "ledu",
      "cancel", "नहीं", "இல்லை", "வேண்டாம்", "ಇಲ್ಲ", "ಬೇಡ", "వద్దు", "లేదు"}
QUESTION_TOKENS = {"who", "how", "kaun", "kitna", "kitne", "kisne", "yaar", "yaaru", "evaru", "yevaru", "evlo",
                   "evvalavu", "entha", "enta", "eshtu", "ellaru", "total", "summary", "today", "aaj", "indru",
                   "inniki", "ivattu", "eeroju"}
REPAY_PATTERNS = [r"\bpaid\b", r"\bgave\b", r"\breturned\b", r"\bdiya\b", r"\bdiye\b", r"\bjama\b", r"\bvapas\b",
                  r"kuduth", r"koduth", r"\bkotta", r"\bkottaru\b", r"ichad", r"icchad", r"ichar", r"ichaar",
                  r"ichind", r"\breceived\b",
                  # Native script: Hindi, Tamil, Kannada, Telugu
                  r"दिया", r"दिए", r"लौटा", r"जमा", r"चुका", r"கொடுத்த", r"குடுத்த", r"கட்டின", r"திருப்பி",
                  r"ಕೊಟ್ಟ", r"ಪಾವತಿ", r"ವಾಪಸ್", r"ಹಿಂತಿರುಗಿ", r"ఇచ్చా", r"ఇచ్చి", r"చెల్లించ", r"కట్టా"]
REQUEST_PATTERNS = [r"\bask\b", r"\brequest\b", r"\blink\b", r"\bremind\b", r"anupp", r"\bbhej", r"kalis",
                    r"pamp", r"yaad dila"]
CREDIT_PATTERNS = [r"udh?aa?r", r"\bcredit\b", r"\bkadan\b", r"\bsaa?la\b", r"\bappu\b", r"\bkhata\b",
                   r"उधार", r"கடன்", r"ಸಾಲ", r"అప్పు", r"బాకీ"]
CASH_PATTERNS = [r"\bcash\b", r"\bnaga?d", r"\bnaqad\b", r"\brokk?am\b"]
SALE_PATTERNS = [r"\bsale\b", r"\bsold\b", r"\bbech", r"\bvith", r"\bammak"]
UNIT_RE = r"(?:kg|kgs|kilo|g|gm|gms|gram|grams|l|ltr|litre|liter|ml|packet|packets|pkt|pcs|pc|piece|pieces|dozen)"
STOP_WORDS = {
    "rupees", "rupee", "rs", "rupaye", "rupay", "roopai", "rubai", "ku", "ki", "ko", "ka", "ke", "ge", "ne", "kke",
    "and", "for", "the", "me", "to", "from", "my", "is", "has", "with", "today", "ok", "yes", "no", "sir", "anna",
    "akka", "amma", "didi", "bhai", "paid", "gave", "cash", "udhaar", "udhar", "credit", "kadan", "saala", "appu",
    "ask", "send", "link", "remind", "request", "sale", "sold", "kg", "kilo", "rice", "sugar", "dal", "oil", "milk",
    "bread", "eggs", "soap", "tea", "atta", "onion", "onions", "biscuits", "please", "now", "money", "owes", "owe",
    "who", "how", "much", "total", "a", "an", "of", "in", "on", "at", "nagad", "jama", "diya", "diye", "ichadu",
}
ITEM_WORDS = ["rice", "dal", "sugar", "oil", "milk", "bread", "eggs", "soap", "tea", "atta", "onions", "onion",
              "biscuits", "salt", "coffee", "ghee", "arisi", "chawal"]


def _tokens(text: str) -> list[str]:
    return [t.strip(".,!?।|;:\"'“”()") for t in (text or "").lower().split() if t.strip(".,!?।|;:\"'“”()")]


def _has(patterns: list[str], text: str) -> bool:
    return any(re.search(p, text) for p in patterns)


def all_numbers(text: str) -> list[int]:
    nums = []
    for match in re.finditer(r"\d[\d,]*", text or ""):
        digits = match.group(0).replace(",", "")
        if digits.isdigit():
            nums.append(int(digits))
    return nums


def money_numbers(text: str) -> list[int]:
    """Numbers that are not quantities like '2 kg'."""
    nums = []
    for match in re.finditer(r"\d[\d,]*(?:\.\d+)?", text or ""):
        after = (text or "")[match.end():match.end() + 10].lower()
        if re.match(rf"\s*{UNIT_RE}\b", after):
            continue
        digits = match.group(0).split(".")[0].replace(",", "")
        if digits.isdigit():
            nums.append(int(digits))
    return nums


def match_known_name(text: str, known_names: list[str]) -> str | None:
    best, best_score = None, 0.0
    for token in re.findall(r"\S+", text or ""):
        token_key = name_key(token.strip(".,!?\"'"))
        if len(token_key) < 3:
            continue
        for name in known_names:
            score = fuzz.ratio(token_key, name_key(name))
            if score > best_score:
                best, best_score = name, score
    return best if best_score >= 85 else None


def _guess_name(text: str) -> str | None:
    for word in re.findall(r"[A-Za-z]{3,}", text or ""):
        if word.lower() not in STOP_WORDS:
            return word.capitalize()
    return None


def _items(text: str) -> list[str]:
    low = (text or "").lower()
    found = []
    for qty, unit, word in re.findall(rf"(\d+(?:\.\d+)?)\s*({UNIT_RE})\s+([a-z]+)", low):
        found.append(f"{word} {qty} {unit}")
    for word in ITEM_WORDS:
        if re.search(rf"\b{word}\b", low) and not any(f.startswith(word) for f in found):
            found.append(word)
    return found[:5]


# ------------------------------------------------------------------ parsers
def quick_yes_no(text: str) -> ParsedCommand | None:
    tokens = _tokens(text)
    if not tokens or len(tokens) > 3:
        return None
    nums = all_numbers(text)
    if tokens[0] in NO and len(nums) == 1:
        return ParsedCommand(intent="correct", amount=nums[0], source="rules")
    if nums:
        return None
    if any(t in YES for t in tokens):
        return ParsedCommand(intent="confirm", source="rules")
    if any(t in NO for t in tokens):
        return ParsedCommand(intent="reject", source="rules")
    return None


def rule_parse(text: str, known_names: list[str]) -> ParsedCommand:
    low = (text or "").lower()
    tokens = set(_tokens(text))
    money = money_numbers(text)
    amount = money[0] if money else None
    name = match_known_name(text, known_names) or _guess_name(text)
    mode = "cash" if _has(CASH_PATTERNS, low) else ("paytm" if re.search(r"paytm|\bupi\b", low) else None)

    if "?" in text or (tokens & QUESTION_TOKENS and amount is None):
        return ParsedCommand(intent="query", question=text, source="rules")
    if _has(REQUEST_PATTERNS, low) and name:
        intent = "request_payment"
    elif _has(REPAY_PATTERNS, low) and _has(CREDIT_PATTERNS, low):
        # "udhaar diya" = gave on credit, "udhaar lautaya" = paid it back: too risky to guess.
        return ParsedCommand(intent="unknown", customer_name=name, amount=amount, source="rules",
                             warning="intent_unclear")
    elif _has(REPAY_PATTERNS, low) and name:
        intent = "record_repayment"
    elif _has(SALE_PATTERNS, low) and not _has(CREDIT_PATTERNS, low):
        intent, name = "cash_sale", None
    elif _has(CREDIT_PATTERNS, low) or (name and amount):
        intent = "add_credit"
    else:
        intent = "unknown"
    return ParsedCommand(intent=intent, customer_name=name, amount=amount, items=_items(text),
                         payment_mode=mode, source="rules")


def _parse_json(content: str) -> dict:
    content = sarvam.strip_think(content)
    content = re.sub(r"^```(?:json)?|```$", "", content.strip(), flags=re.M).strip()
    match = re.search(r"\{.*\}", content, re.S)
    if not match:
        raise ValueError(f"No JSON object in LLM output: {content[:200]}")
    return json.loads(match.group(0))


def llm_parse(text: str, known_names: list[str], pending_summary: str | None) -> ParsedCommand:
    lines = [f"Known customers: {', '.join(known_names[:200]) or 'none'}"]
    if pending_summary:
        lines.append(f"An entry is waiting for confirmation: {pending_summary}")
    lines.append(f'Shopkeeper said: "{text}"')
    message = sarvam.llm_chat(
        [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": "\n".join(lines)}],
        model=settings.llm_model,
        response_format=RESPONSE_FORMAT,
        max_tokens=600,
    )
    data = _parse_json(message.get("content") or "")
    return ParsedCommand(**data, source="llm")


def _unknown(cmd: ParsedCommand, reason: str) -> ParsedCommand:
    return cmd.model_copy(update={"intent": "unknown", "warning": reason})


def validate(cmd: ParsedCommand, transcript: str) -> ParsedCommand:
    """Deterministic checks. Code, not the LLM, has the final say on amounts."""
    if cmd.needs_clarification and cmd.intent not in ("confirm", "reject"):
        return _unknown(cmd, "needs_clarification")
    if cmd.intent in ("add_credit", "record_repayment", "cash_sale", "correct") and cmd.amount is None:
        return _unknown(cmd, "amount_missing")
    if cmd.amount is not None:
        if not 1 <= cmd.amount <= settings.max_amount_rupees:
            return _unknown(cmd, "amount_out_of_range")
        heard = all_numbers(transcript)
        if heard and cmd.amount not in heard:
            money = money_numbers(transcript)
            if len(money) == 1 and 1 <= money[0] <= settings.max_amount_rupees:
                cmd = cmd.model_copy(update={"amount": money[0], "warning": "amount_from_transcript"})
            else:
                return _unknown(cmd, "amount_unclear")
    if cmd.intent in ("add_credit", "record_repayment", "request_payment") and not cmd.customer_name:
        return _unknown(cmd, "name_missing")
    return cmd


def understand(transcript: str, known_names: list[str], pending_summary: str | None = None) -> ParsedCommand:
    quick = quick_yes_no(transcript)  # "yes", "illa", "no 180": no LLM call needed
    if quick:
        return validate(quick, transcript)
    parsed = None
    if settings.llm_enabled:
        try:
            parsed = llm_parse(transcript, known_names, pending_summary)
        except (sarvam.SarvamError, ValueError, ValidationError, json.JSONDecodeError) as exc:
            log.warning("LLM parse failed, using rules: %s", exc)
    if parsed is None:
        parsed = rule_parse(transcript, known_names)
    log.info("Parsed %r -> %s", transcript, parsed.model_dump())
    return validate(parsed, transcript)
