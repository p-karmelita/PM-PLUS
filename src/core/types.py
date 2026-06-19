from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Literal, Optional
from datetime import datetime
import uuid


class CheckInMessage(BaseModel):
    type: Literal["check_in"] = "check_in"
    employee_id: str
    employee_name: str
    status: str
    blockers: Optional[str] = None
    workload: Literal["light", "normal", "heavy", "overwhelmed"] = "normal"
    timestamp: Optional[str] = None


class HistoryQuery(BaseModel):
    type: Literal["history_query"] = "history_query"
    query_id: str = Field(default_factory=lambda: f"q-{uuid.uuid4().hex[:8]}")
    employee_id: str
    days: int = 30


class HistoryResponse(BaseModel):
    type: Literal["history_response"] = "history_response"
    query_id: str
    employee_id: str
    past_blockers: list[str]
    risk_count: int
    summary: str


class ResourceRequest(BaseModel):
    type: Literal["resource_req"] = "resource_req"
    request_id: str = Field(default_factory=lambda: f"r-{uuid.uuid4().hex[:8]}")
    overloaded_employee: str
    task_description: str
    urgency: Literal["low", "medium", "high"] = "medium"


class ResourceResponse(BaseModel):
    type: Literal["resource_response"] = "resource_response"
    request_id: str
    available_employee: str
    confidence: float
    notes: Optional[str] = None


class RiskFlag(BaseModel):
    type: Literal["risk_flag"] = "risk_flag"
    flag_id: str = Field(default_factory=lambda: f"f-{uuid.uuid4().hex[:8]}")
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    employee_name: str
    risk_type: Literal["it_blocker", "overload", "dependency", "deadline", "other"]
    description: str
    recommended_action: str
    requires_approval: bool = True


class ApprovalResponse(BaseModel):
    type: Literal["approval"] = "approval"
    flag_id: str
    approved: bool
    pm_notes: Optional[str] = None


class EventLog(BaseModel):
    type: Literal["event_log"] = "event_log"
    source_agent: str
    event_kind: Literal[
        "check_in_received", "risk_flagged", "resource_requested",
        "approval_received", "task_moved", "report_requested",
    ]
    payload: dict
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")


class AgentEvent(BaseModel):
    event_type: str
    agent_name: str
    room_id: Optional[str] = None
    content: dict
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
