import json
import logging
import os
from typing import Callable, Optional

from termcolor import cprint

from band.core.simple_adapter import SimpleAdapter
from band.core.types import PlatformMessage
from band.core.protocols import AgentToolsProtocol

from core.types import ResourceRequest, ResourceResponse, AgentEvent
from core.router import MessageRouter
from core.llm import call_llm
from agents.balancer_prompts import BALANCER_SYSTEM_PROMPT

logger = logging.getLogger(__name__)


class ResourceBalancerAdapter(SimpleAdapter[list]):

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
        if msg.sender_name == "resource_balancer":
            return

        router  = MessageRouter(tools, os.getenv("OPS_ROOM_ID", ""))
        payload = MessageRouter.parse_payload(msg.content)

        if isinstance(payload, ResourceRequest):
            cprint(f"\n  [BALANCER] ← LOOP 2: resource request for {payload.overloaded_employee} (urgency: {payload.urgency})", "blue", attrs=["bold"])
            cprint(f"             task: {payload.task_description}", "blue")
            await self._handle_resource_request(payload, router)

    async def _handle_resource_request(
        self,
        request: ResourceRequest,
        router: MessageRouter,
    ) -> None:
        cprint(f"  [BALANCER] ⚙ calling LLM to find available resource...", "magenta")

        raw = await call_llm(
            BALANCER_SYSTEM_PROMPT,
            json.dumps({
                "request_id":          request.request_id,
                "overloaded_employee": request.overloaded_employee,
                "task_description":    request.task_description,
                "urgency":             request.urgency,
            }),
        )

        try:
            result = json.loads(raw)
            response = ResourceResponse(**result)
            cprint(f"  [BALANCER] → LOOP 2: recommending {response.available_employee} (confidence: {response.confidence})", "blue", attrs=["bold"])
            if response.notes:
                cprint(f"             notes: {response.notes}", "blue")
            await router.mention("risk_analyzer", response)
            self._emit("resource_recommended", response.model_dump())
        except Exception as e:
            cprint(f"  [BALANCER] ✗ failed to send resource response: {e}", "red")

    def _emit(self, event_type: str, content: dict) -> None:
        if self.event_callback:
            self.event_callback(AgentEvent(
                event_type=event_type,
                agent_name="resource_balancer",
                content=content,
            ).model_dump())


async def start_resource_balancer(on_event=None):
    from dotenv import load_dotenv
    load_dotenv()

    from band import Agent
    from band.config import load_agent_config

    agent_id, api_key = load_agent_config("resource_balancer")

    agent = Agent.create(
        adapter=ResourceBalancerAdapter(on_event=on_event),
        agent_id=agent_id,
        api_key=api_key,
    )
    await agent.run()
