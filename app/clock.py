"""App clock. The demo can move time forward so reminders fire on stage.

All timestamps are stored as naive UTC datetimes.
"""
import threading
from datetime import date, datetime, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30))

_lock = threading.Lock()
_offset = timedelta(0)


def real_utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def now() -> datetime:
    return real_utcnow() + _offset


def advance(days: float) -> None:
    global _offset
    with _lock:
        _offset += timedelta(days=days)


def reset() -> None:
    global _offset
    with _lock:
        _offset = timedelta(0)


def offset_days() -> float:
    return round(_offset.total_seconds() / 86400, 2)


def to_ist(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc).astimezone(IST)


def ist_today() -> date:
    return to_ist(now()).date()


def days_since(dt: datetime) -> int:
    return max(0, (now() - dt).days)
