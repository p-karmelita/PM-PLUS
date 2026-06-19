import json
import re
from typing import Optional
from .types import (
    CheckInMessage, HistoryQuery, HistoryResponse,
    ResourceRequest, ResourceResponse, RiskFlag,
    ApprovalResponse, EventLog,
)

ALL_TYPES = [
    CheckInMessage, HistoryQuery, HistoryResponse,
    ResourceRequest, ResourceResponse, RiskFlag,
    ApprovalResponse, EventLog,
]


class MessageRouter:
    def __init__(self, tools, default_room_id: str):
        self.tools = tools
        self.default_room_id = default_room_id

    async def mention(self, agent_name: str, payload, room_id: str = None) -> None:
        if hasattr(payload, "model_dump_json"):
            body = payload.model_dump_json()
        else:
            body = json.dumps(payload)
        content = f"@{agent_name} {body}"
        await self.tools.send_message(content=content, mentions=[agent_name])

    async def broadcast(self, message: str) -> None:
        await self.tools.send_message(content=message)

    @staticmethod
    def parse_payload(content: str) -> Optional[object]:
        match = re.search(r'\{.*\}', content, re.DOTALL)
        if not match:
            return None
        try:
            data = json.loads(match.group())
            msg_type = data.get("type")
            for model in ALL_TYPES:
                for field in model.model_fields.values():
                    if hasattr(field, 'default') and field.default == msg_type:
                        return model(**data)
            return None
        except Exception:
            return None

    @staticmethod
    def get_mention(content: str) -> Optional[str]:
        match = re.match(r'^@(\w+)', content)
        return match.group(1) if match else None
