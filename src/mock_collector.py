# Posts fake check-ins to Band for testing without Role 2.
# Run: python src/mock_collector.py

import asyncio
import json
import os

import httpx
from dotenv import load_dotenv

load_dotenv()

REST              = "https://app.band.ai/api/v1"
KEY               = os.getenv("REPORTER_API_KEY")
OPS               = os.getenv("OPS_ROOM_ID")
RISK_ANALYZER_ID  = os.getenv("RISK_ANALYZER_AGENT_ID")  # needed for mentions

CHECKINS = [
    {
        "type": "check_in", "employee_id": "e1", "employee_name": "Alice",
        "status": "Still waiting for IT to fix my access. Third day.",
        "blockers": "IT ticket unresolved 3 days.", "workload": "heavy",
    },
    {
        "type": "check_in", "employee_id": "e2", "employee_name": "Bob",
        "status": "All tasks done ahead of schedule.", "workload": "light",
    },
    {
        "type": "check_in", "employee_id": "e3", "employee_name": "Carol",
        "status": "Blocked on Alice finishing the API.",
        "blockers": "Dependency on Alice.", "workload": "normal",
    },
    {
        "type": "check_in", "employee_id": "e4", "employee_name": "Dave",
        "status": "Assigned to 5 parallel tasks, cannot deliver any on time.",
        "blockers": "Too many simultaneous assignments from 3 different PMs.", "workload": "heavy",
    },
]


async def post(checkin: dict):
    content = f"@risk_analyzer {json.dumps(checkin)}"
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{REST}/agent/chats/{OPS}/messages",
            headers={"X-API-Key": KEY},
            json={
                "message": {
                    "content": content,
                    "mentions": [
                        {"id": RISK_ANALYZER_ID, "name": "risk_analyzer", "handle": "risk_analyzer"},
                    ],
                }
            },
        )
    print(f"Posted: {checkin['employee_name']} → {r.status_code}")
    if r.status_code not in (200, 201):
        print(f"  Error: {r.text}")


async def main():
    for c in CHECKINS:
        await post(c)
        await asyncio.sleep(2)


asyncio.run(main())
