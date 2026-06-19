import asyncio
import logging
import os

import httpx
from dotenv import load_dotenv
from agents.risk import start_risk_analyzer
from agents.reporter import start_reporter
from agents.balancer import start_resource_balancer

logging.basicConfig(level=logging.INFO)
load_dotenv()

_EVENTS_URL = os.getenv("STATE_STORE_URL", "http://localhost:3000") + "/events/agent"


async def _post_event(event: dict) -> None:
    try:
        async with httpx.AsyncClient() as client:
            await client.post(_EVENTS_URL, json=event, timeout=3.0)
    except Exception:
        pass  # never let SSE bridge failures crash an agent


def on_event(event: dict) -> None:
    print(f"[AgentEvent] {event}")
    asyncio.create_task(_post_event(event))


async def main():
    await asyncio.gather(
        start_risk_analyzer(on_event=on_event),
        start_reporter(on_event=on_event),
        start_resource_balancer(on_event=on_event),
    )


if __name__ == "__main__":
    asyncio.run(main())
