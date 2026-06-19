import asyncio
import json
import logging
import os
from typing import Callable, Optional

import httpx
from termcolor import cprint

from band.core.simple_adapter import SimpleAdapter
from band.core.types import PlatformMessage
from band.core.protocols import AgentToolsProtocol

from core.types import HistoryQuery, HistoryResponse, EventLog, AgentEvent, CheckInMessage
from core.router import MessageRouter
from core.llm import call_llm
from agents.reporter_prompts import HISTORY_PROMPT, REPORT_PROMPT

logger = logging.getLogger(__name__)


class ReporterAdapter(SimpleAdapter[list]):

    def __init__(self, on_event: Optional[Callable] = None):
        super().__init__(history_converter=None)
        self.event_callback = on_event

    async def on_message(
        self,
        msg: PlatformMessage,
        tools: AgentToolsProtocol,
        history,
        participants_msg,
        contacts_msg,
        *,
        is_session_bootstrap: bool,
        room_id: str,
    ) -> None:
        if msg.sender_name == "reporter":
            return

        router  = MessageRouter(tools, os.getenv("OPS_ROOM_ID", ""))
        payload = MessageRouter.parse_payload(msg.content)

        if payload is not None:
            if isinstance(payload, HistoryQuery):
                cprint(f"  [REPORTER] ← LOOP 1: history query for employee {payload.employee_id} (id: {payload.query_id})", "yellow")
                await self._handle_history_query(payload, router)

            elif isinstance(payload, EventLog):
                cprint(f"  [REPORTER] ✎ archiving event: {payload.event_kind}", "yellow")
                await self._archive(payload.model_dump(), "/events")

            elif isinstance(payload, CheckInMessage):
                cprint(f"  [REPORTER] ✎ archiving check-in: {payload.employee_name}", "yellow")
                await self._archive(payload.model_dump(), "/checkins")

        mention = MessageRouter.get_mention(msg.content)
        if mention == "reporter" and "generate_report" in msg.content:
            cprint(f"  [REPORTER] ▶ generating weekly report...", "yellow", attrs=["bold"])
            await self._generate_report(tools)

    async def _handle_history_query(
        self,
        query: HistoryQuery,
        router: MessageRouter,
    ) -> None:
        state_store = os.getenv("STATE_STORE_URL", "")
        events = []
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(
                    f"{state_store}/events",
                    params={"employee_id": query.employee_id, "days": query.days},
                )
                events = r.json()
        except Exception:
            events = []

        cprint(f"  [REPORTER] ⚙ calling LLM to summarize history ({len(events)} past events)...", "magenta")
        raw = await call_llm(
            HISTORY_PROMPT,
            json.dumps({
                "query_id":    query.query_id,
                "employee_id": query.employee_id,
                "events":      events,
            }),
        )

        try:
            result = json.loads(raw)
            response = HistoryResponse(**result)
            cprint(f"  [REPORTER] → LOOP 1: sending history back to risk_analyzer — \"{response.summary}\"", "yellow", attrs=["bold"])
            await router.mention("risk_analyzer", response)
        except Exception as e:
            cprint(f"  [REPORTER] ✗ failed to send history response: {e}", "red")

    async def _archive(self, data: dict, path: str) -> None:
        state_store = os.getenv("STATE_STORE_URL", "")
        try:
            async with httpx.AsyncClient() as client:
                await client.post(f"{state_store}{path}", json=data)
        except Exception:
            pass  # StateStore not running yet (Role 2 provides it)

    async def _generate_report(self, tools: AgentToolsProtocol) -> None:
        state_store = os.getenv("STATE_STORE_URL", "")
        snapshot    = {}
        try:
            async with httpx.AsyncClient() as client:
                r        = await client.get(f"{state_store}/weekly-snapshot")
                snapshot = r.json()
        except Exception:
            pass

        report = await call_llm(REPORT_PROMPT, json.dumps(snapshot))
        cprint(f"  [REPORTER] ✓ weekly report posted", "yellow", attrs=["bold"])
        await tools.send_message(content=report)


async def start_reporter(on_event=None):
    from dotenv import load_dotenv
    load_dotenv()

    from band import Agent
    from band.config import load_agent_config

    agent_id, api_key = load_agent_config("reporter")

    agent = Agent.create(
        adapter=ReporterAdapter(on_event=on_event),
        agent_id=agent_id,
        api_key=api_key,
    )
    await agent.run()
