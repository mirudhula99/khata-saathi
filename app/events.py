"""Tiny pub/sub for Server-Sent Events.

Channels: "merchant:<id>" for the shop app, "customer:<id>" for the
customer-phone simulator. publish() is safe to call from any thread.
"""
import asyncio
import json
import threading
from collections import defaultdict


class EventBus:
    def __init__(self) -> None:
        self._subs: dict[str, set[asyncio.Queue]] = defaultdict(set)
        self._loop: asyncio.AbstractEventLoop | None = None
        self._lock = threading.Lock()

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def subscribe(self, channel: str) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        with self._lock:
            self._subs[channel].add(queue)
        return queue

    def unsubscribe(self, channel: str, queue: asyncio.Queue) -> None:
        with self._lock:
            self._subs[channel].discard(queue)

    def publish(self, channel: str, data: dict) -> None:
        if self._loop is None or self._loop.is_closed():
            return
        payload = json.dumps(data, default=str, ensure_ascii=False)
        with self._lock:
            queues = list(self._subs.get(channel, ()))
        for queue in queues:
            self._loop.call_soon_threadsafe(_put, queue, payload)


def _put(queue: asyncio.Queue, payload: str) -> None:
    try:
        queue.put_nowait(payload)
    except asyncio.QueueFull:
        pass


bus = EventBus()
