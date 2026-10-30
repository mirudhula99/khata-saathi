"""App clock. The demo can move time forward so reminders fire on stage.

All timestamps are stored as naive UTC datetimes. The offset is saved to a file, so a restart
(or --reload after a code change) mid-demo doesn't jump the clock back.
"""
import logging
import threading
from datetime import date, datetime, timedelta, timezone

from .config import settings

IST = timezone(timedelta(hours=5, minutes=30))
log = logging.getLogger("khata.clock")

_lock = threading.Lock()


def _load() -> timedelta:
    try:
        return timedelta(seconds=float(settings.clock_file.read_text().strip()))
    except (OSError, ValueError):
        return timedelta(0)


def _save() -> None:
    try:
        settings.clock_file.write_text(str(_offset.total_seconds()))
    except OSError:
        log.warning("Couldn't save the demo clock to %s", settings.clock_file)


_offset = _load()


def real_utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def now() -> datetime:
    return real_utcnow() + _offset


def advance(days: float) -> None:
    global _offset
    with _lock:
        _offset += timedelta(days=days)
        _save()


def reset() -> None:
    global _offset
    with _lock:
        _offset = timedelta(0)
        _save()


def offset_days() -> float:
    return round(_offset.total_seconds() / 86400, 2)


def to_ist(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc).astimezone(IST)


def ist_today() -> date:
    return to_ist(now()).date()


def days_since(dt: datetime) -> int:
    return max(0, (now() - dt).days)
