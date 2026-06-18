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
            model="openai/gpt-5-5",  # Changed from gpt-5-5 to gpt-3-5
            api_key=aiml_api_key,
        ),
        checkpointer=InMemorySaver(),
        custom_section=(
            "You are the Collector agent for the Data & Orchestrator backbone. "
            "Your job is to gather project updates, check-ins, external signals, "
            "status reports, risks, blockers, and resource-related information. "
            "Normalize the collected data into structured, concise summaries that "
            "can be stored in the shared StateStore and used by other agents. "
            "Do not make final project decisions. Focus on accurate collection, "
            "deduplication, classification, and routing of information."
        ),
    )

    agent_id, api_key = load_agent_config("collector")
    agent = Agent.create(adapter=adapter, agent_id=agent_id, api_key=api_key)

    logger.info("Collector agent is running! Press Ctrl+C to stop.")
    await agent.run()


if __name__ == "__main__":
    asyncio.run(main())