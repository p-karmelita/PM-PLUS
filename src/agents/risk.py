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

from core.types import (
    CheckInMessage, HistoryQuery, HistoryResponse,
    ResourceRequest, ResourceResponse, RiskFlag,
    ApprovalResponse, EventLog, AgentEvent,
)
from core.router import MessageRouter
from core.llm import call_llm
from agents.risk_prompts import RISK_SYSTEM_PROMPT

logger = logging.getLogger(__name__)
TIMEOUT = 30.0


class RiskAnalyzerAdapter(SimpleAdapter[list]):

    def __init__(self, on_event: Optional[Callable] = None):
        super().__init__(history_converter=None)
        self.event_callback = on_event
        self._pending_history: dict[str, asyncio.Future] = {}
        self._pending_resource: dict[str, asyncio.Future] = {}

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
        if msg.sender_name == "risk_analyzer":
            return

        router  = MessageRouter(tools, os.getenv("OPS_ROOM_ID", ""))
        payload = MessageRouter.parse_payload(msg.content)
        if not payload:
            return

        if isinstance(payload, CheckInMessage):
            # create_task so on_message returns immediately — SDK can then deliver
            # the reporter's history response without deadlocking on this handler
            asyncio.create_task(self._handle_check_in(payload, router))

        elif isinstance(payload, HistoryResponse):
            cprint(f"  [RISK] ← LOOP 1 response: history for {payload.employee_id} — {payload.summary}", "cyan")
            future = self._pending_history.pop(payload.query_id, None)
            if future and not future.done():
                future.set_result(payload)

        elif isinstance(payload, ResourceResponse):
            cprint(f"  [RISK] ← LOOP 2 response: {payload.available_employee} is available (confidence {payload.confidence})", "cyan")
            future = self._pending_resource.pop(payload.request_id, None)
            if future and not future.done():
                future.set_result(payload)

        elif isinstance(payload, ApprovalResponse):
            status = "APPROVED ✓" if payload.approved else "REJECTED ✗"
            color  = "green" if payload.approved else "red"
            cprint(f"  [RISK] ← LOOP 3 response: flag {payload.flag_id} {status}", color, attrs=["bold"])
            self._emit("approval_received", payload.model_dump())

    async def _handle_check_in(
        self,
        check_in: CheckInMessage,
        router: MessageRouter,
    ) -> None:
        cprint(f"\n{'='*60}", "white")
        cprint(f"  [RISK] ▶ CHECK-IN received: {check_in.employee_name}", "white", attrs=["bold"])
        cprint(f"          status: {check_in.status}", "white")
        if check_in.blockers:
            cprint(f"          blockers: {check_in.blockers}", "yellow")

        # LOOP 1
        cprint(f"  [RISK] → LOOP 1: asking reporter for {check_in.employee_name}'s history...", "cyan")
        history = await self._wait_for_history(check_in, router)

        if history:
            cprint(f"  [RISK] ← LOOP 1: got history — {history.summary}", "cyan")
        else:
            cprint(f"  [RISK] ← LOOP 1: timed out, proceeding without history", "yellow")

        cprint(f"  [RISK] ⚙ calling LLM to assess risk...", "magenta")
        user_message = json.dumps({
            "check_in": check_in.model_dump(),
            "history":  history.model_dump() if history else {"summary": "No history available."},
        })
        raw = await call_llm(RISK_SYSTEM_PROMPT, user_message)

        try:
            result = json.loads(raw)
        except json.JSONDecodeError:
            cprint(f"  [RISK] ✗ LLM returned invalid JSON: {raw}", "red")
            return

        if result.get("type") == "no_risk":
            cprint(f"  [RISK] ✓ NO RISK for {check_in.employee_name}", "green", attrs=["bold"])
            return

        flag = RiskFlag(**result)
        severity_color = {"LOW": "white", "MEDIUM": "yellow", "HIGH": "red", "CRITICAL": "red"}.get(flag.severity, "white")
        cprint(f"  [RISK] ⚠ RISK DETECTED: {flag.severity} — {flag.risk_type}", severity_color, attrs=["bold"])
        cprint(f"          {flag.description}", severity_color)

        # LOOP 2
        if flag.risk_type == "overload":
            cprint(f"  [RISK] → LOOP 2: asking balancer for available resource...", "cyan")
            availability = await self._wait_for_resource(flag, router)
            if availability:
                flag.recommended_action = (
                    f"Move task to {availability.available_employee}. "
                    f"{availability.notes or ''}"
                ).strip()
                cprint(f"  [RISK] ← LOOP 2: reassign to {availability.available_employee}", "cyan")

        # LOOP 3 — post to PM_ALERTS_ROOM_ID via REST; tools is bound to OPS room
        # context and "pm" is not a valid participant handle in Band
        cprint(f"  [RISK] → LOOP 3: posting flag to PM alerts room...", "red", attrs=["bold"])
        pm_room  = os.getenv("PM_ALERTS_ROOM_ID", "")
        risk_key = os.getenv("RISK_ANALYZER_API_KEY", "")
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"https://app.band.ai/api/v1/agent/chats/{pm_room}/messages",
                headers={"X-API-Key": risk_key},
                json={"message": {"content": f"🚨 RISK FLAG\n{flag.model_dump_json()}", "mentions": []}},
            )
        if r.status_code in (200, 201):
            cprint(f"  [RISK] ✓ flag posted to PM alerts — awaiting approval", "red")
        else:
            cprint(f"  [RISK] ✗ failed to post PM alert: {r.status_code} {r.text[:120]}", "red")

        await router.mention("reporter", EventLog(
            source_agent="risk_analyzer",
            event_kind="risk_flagged",
            payload=flag.model_dump(),
        ))
        cprint(f"{'='*60}\n", "white")
        self._emit("risk_flagged", flag.model_dump())

    async def _wait_for_history(
        self,
        check_in: CheckInMessage,
        router: MessageRouter,
    ) -> Optional[HistoryResponse]:
        query  = HistoryQuery(employee_id=check_in.employee_id)
        future = asyncio.get_event_loop().create_future()
        self._pending_history[query.query_id] = future

        await router.mention("reporter", query)

        try:
            return await asyncio.wait_for(asyncio.shield(future), timeout=TIMEOUT)
        except asyncio.TimeoutError:
            self._pending_history.pop(query.query_id, None)
            return None

    async def _wait_for_resource(
        self,
        flag: RiskFlag,
        router: MessageRouter,
    ) -> Optional[ResourceResponse]:
        req    = ResourceRequest(
            overloaded_employee=flag.employee_name,
            task_description=flag.recommended_action,
            urgency="high" if flag.severity == "CRITICAL" else "medium",
        )
        future = asyncio.get_event_loop().create_future()
        self._pending_resource[req.request_id] = future

        await router.mention("resource_balancer", req)

        try:
            return await asyncio.wait_for(asyncio.shield(future), timeout=TIMEOUT)
        except asyncio.TimeoutError:
            self._pending_resource.pop(req.request_id, None)
            return None

    def _emit(self, event_type: str, content: dict) -> None:
        if self.event_callback:
            self.event_callback(AgentEvent(
                event_type=event_type,
                agent_name="risk_analyzer",
                content=content,
            ).model_dump())


async def start_risk_analyzer(on_event=None):
    from dotenv import load_dotenv
    load_dotenv()

    from band import Agent
    from band.config import load_agent_config

    agent_id, api_key = load_agent_config("risk_analyzer")

    agent = Agent.create(
        adapter=RiskAnalyzerAdapter(on_event=on_event),
        agent_id=agent_id,
        api_key=api_key,
    )
    await agent.run()
