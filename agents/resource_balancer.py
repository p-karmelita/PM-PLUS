import asyncio
import logging
import os

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver
from thenvoi import Agent
from thenvoi.adapters import LangGraphAdapter
from thenvoi.config import load_agent_config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def main():
    load_dotenv()

    aiml_api_key = os.getenv("AIML_API_KEY")
    if not aiml_api_key:
        raise RuntimeError(
            "Missing AIML_API_KEY. Add it to your .env file like this:\n"
            "AIML_API_KEY=<your-aimlapi-key>"
        )

    adapter = LangGraphAdapter(
        llm=ChatOpenAI(
            base_url="https://api.aimlapi.com/v1",
            model="openai/gpt-5-5",
            api_key=aiml_api_key,
        ),
        checkpointer=InMemorySaver(),
        custom_section=(
            "You are the Resource Balancer agent for the Data & Orchestrator backbone. "
            "Your job is to analyze project workload, capacity, ownership, priorities, "
            "risks, dependencies, and blockers. Recommend resource allocation changes, "
            "task rebalancing, escalation paths, and trade-offs. "
            "When human approval is required, clearly mark the decision as requiring "
            "Human-in-the-Loop PM approval. Do not silently override PM-level decisions."
        ),
    )

    agent_id, api_key = load_agent_config("resource_balancer")
    agent = Agent.create(adapter=adapter, agent_id=agent_id, api_key=api_key)

    logger.info("Resource Balancer agent is running! Press Ctrl+C to stop.")
    await agent.run()


if __name__ == "__main__":
    asyncio.run(main())