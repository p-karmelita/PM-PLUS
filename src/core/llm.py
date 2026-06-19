import os
from typing import Optional, Tuple
from openai import AsyncOpenAI

_client: Optional[AsyncOpenAI] = None
_model: Optional[str] = None


def _get_client() -> Tuple[AsyncOpenAI, str]:
    global _client, _model
    if _client is None:
        provider = os.getenv("LLM_PROVIDER", "aiml")
        if provider == "featherless":
            _client = AsyncOpenAI(
                base_url="https://api.featherless.ai/v1",
                api_key=os.getenv("FEATHERLESS_API_KEY"),
            )
            _model = os.getenv("FEATHERLESS_MODEL", "Qwen/Qwen2.5-72B-Instruct")
        else:
            _client = AsyncOpenAI(
                base_url="https://api.aimlapi.com/v1",
                api_key=os.getenv("AIML_API_KEY"),
            )
            _model = os.getenv("AIML_MODEL", "gpt-4o")
    return _client, _model


def _strip_code_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
        if text.endswith("```"):
            text = text.rsplit("```", 1)[0]
    return text.strip()


async def call_llm(system_prompt: str, user_message: str) -> str:
    client, model = _get_client()
    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_message},
        ],
        max_tokens=800,
        temperature=0.2,
    )
    return _strip_code_fences(response.choices[0].message.content or "")
