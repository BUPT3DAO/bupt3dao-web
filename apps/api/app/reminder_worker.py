"""Small single-purpose process that checks event reminders once per minute."""

import logging
import time

from sqlalchemy.orm import Session

from app.db import engine
from app.event_service import deliver_due_reminders
from app.migrations import ensure_schema

ensure_schema(engine)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("event-reminders")


def run() -> None:
    while True:
        started = time.monotonic()
        try:
            with Session(engine) as db:
                delivered = deliver_due_reminders(db)
            logger.info("Reminder check complete; delivered=%s", delivered)
        except Exception:
            logger.exception("Reminder check failed; will retry next minute")
        time.sleep(max(1, 60 - (time.monotonic() - started)))


if __name__ == "__main__":
    run()
