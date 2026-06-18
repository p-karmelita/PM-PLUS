import asyncio
import logging
from dotenv import load_dotenv
from agents.risk import start_risk_analyzer
from agents.reporter import start_reporter

logging.basicConfig(level=logging.INFO)
load_dotenv()


# Role 3 replaces this stub with their Socket.io emitter:
# def on_event(event: dict):
#     socketio.emit("agent_event", event)
def on_event(event: dict):
    print(f"[AgentEvent] {event}")


async def main():
    await asyncio.gather(
        start_risk_analyzer(on_event=on_event),
        start_reporter(on_event=on_event),
    )


if __name__ == "__main__":
    asyncio.run(main())
