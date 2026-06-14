"""Heterogeneous, keyless model layer.

The anti-anchoring lever is real model diversity, so jurors run on genuinely different
deployments. Two transports, one interface (`ModelRegistry.complete`):

  * OpenAI-family (gpt-4o, gpt-41-mini, o4-mini) -> Microsoft Agent Framework
    `OpenAIChatCompletionClient` (Azure, keyless via DefaultAzureCredential).
  * Catalog models (Phi-4, Mistral-Large-3) -> azure-ai-inference `ChatCompletionsClient`
    against the Foundry model-inference endpoint, also keyless.

Spiked facts baked in here:
  * o-series (o4-mini) is a reasoning model: send the system prompt as a `developer`
    message, no temperature, and give it token headroom.
  * Chat Completions (not the Responses API) is what this resource supports.
  * Phi-4 is capacity-1 TPM -> serialize it with a semaphore and retry on 429.
"""
from __future__ import annotations

import asyncio
import json
import re
from typing import Iterable

from azure.identity import DefaultAzureCredential
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from config import Settings

# API version that supports every deployment we use (o4-mini needs >= 2024-12-01-preview).
OPENAI_API_VERSION = "2024-12-01-preview"
_COGNITIVE_SCOPE = "https://cognitiveservices.azure.com/.default"

# Per-deployment max concurrent calls (Phi-4 is cap-1 TPM; keep others modest on a free sub).
_DEFAULT_CONCURRENCY = 3


def _is_rate_limit(exc: BaseException) -> bool:
    s = f"{type(exc).__name__}: {exc}".lower()
    return "429" in s or "rate" in s and "limit" in s or "too many requests" in s


_retry = retry(
    retry=retry_if_exception(_is_rate_limit),
    wait=wait_exponential(multiplier=2, min=2, max=30),
    stop=stop_after_attempt(5),
    reraise=True,
)


def extract_json(text: str):
    """Tolerant JSON extraction: strips code fences, grabs the first object/array."""
    if text is None:
        raise ValueError("empty model response")
    t = text.strip()
    t = re.sub(r"^```(?:json)?|```$", "", t, flags=re.MULTILINE).strip()
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        pass
    # Find the first balanced {...} or [...].
    for opener, closer in (("{", "}"), ("[", "]")):
        start = t.find(opener)
        if start == -1:
            continue
        depth = 0
        for i in range(start, len(t)):
            if t[i] == opener:
                depth += 1
            elif t[i] == closer:
                depth -= 1
                if depth == 0:
                    return json.loads(t[start : i + 1])
    raise ValueError(f"no JSON found in model response: {text[:200]!r}")


class ModelRegistry:
    """Builds and reuses keyless clients for every deployment; one per process."""

    def __init__(self, settings: Settings):
        self.s = settings
        self.cred = DefaultAzureCredential()
        self.openai_deployments = {settings.gpt4o, settings.gpt4o_mini, settings.oseries}
        self.reasoning = {settings.oseries}
        self._openai_clients: dict[str, object] = {}
        self._inference = None  # lazy azure-ai-inference client (shared, model per call)
        self._sems: dict[str, asyncio.Semaphore] = {
            settings.phi4_deployment: asyncio.Semaphore(1),  # cap-1 TPM
            settings.mistral_deployment: asyncio.Semaphore(2),
        }

    # -- client builders --------------------------------------------------
    def _openai(self, deployment: str):
        if deployment not in self._openai_clients:
            from agent_framework.openai import OpenAIChatCompletionClient

            self._openai_clients[deployment] = OpenAIChatCompletionClient(
                model=deployment,
                azure_endpoint=self.s.openai_endpoint,
                api_version=OPENAI_API_VERSION,
                credential=self.cred,
                instruction_role="developer" if deployment in self.reasoning else "system",
            )
        return self._openai_clients[deployment]

    def _inference_client(self):
        if self._inference is None:
            from azure.ai.inference.aio import ChatCompletionsClient

            endpoint = self.s.catalog_endpoint.rstrip("/") + "/models"
            self._inference = ChatCompletionsClient(
                endpoint=endpoint, credential=self.cred, credential_scopes=[_COGNITIVE_SCOPE]
            )
        return self._inference

    def _sem(self, deployment: str) -> asyncio.Semaphore:
        return self._sems.setdefault(deployment, asyncio.Semaphore(_DEFAULT_CONCURRENCY))

    # -- the one interface ------------------------------------------------
    async def complete(
        self,
        deployment: str,
        system: str,
        user: str,
        *,
        want_json: bool = True,
        max_tokens: int = 700,
        temperature: float = 0.4,
    ) -> str:
        """Return the model's text. `want_json` adds a response_format hint where supported.

        Each attempt is bounded by `llm_timeout_seconds` so a hung model endpoint can't stall a
        whole deliberation — a timeout propagates (it isn't a 429, so it isn't retried) and the
        calling agent degrades gracefully (orchestrator)."""
        timeout = self.s.llm_timeout_seconds
        async with self._sem(deployment):
            if deployment in self.openai_deployments:
                return await self._complete_openai(deployment, system, user, want_json, max_tokens, temperature, timeout)
            return await self._complete_inference(deployment, system, user, max_tokens, temperature, timeout)

    @_retry
    async def _complete_openai(self, deployment, system, user, want_json, max_tokens, temperature, timeout) -> str:
        from agent_framework import ChatOptions, Content, Message

        client = self._openai(deployment)
        reasoning = deployment in self.reasoning
        msgs = [
            Message(role="system", contents=[Content(type="text", text=system)]),
            Message(role="user", contents=[Content(type="text", text=user)]),
        ]
        opts: dict = {"max_tokens": max(max_tokens, 4000) if reasoning else max_tokens}
        if want_json and not reasoning:  # reasoning models can reject response_format
            opts["response_format"] = {"type": "json_object"}
        if not reasoning:  # temperature et al. are unsupported on o-series reasoning models
            opts["temperature"] = temperature
        to = timeout if timeout and timeout > 0 else None
        resp = await asyncio.wait_for(client.get_response(msgs, options=ChatOptions(**opts)), to)
        return resp.text

    @_retry
    async def _complete_inference(self, deployment, system, user, max_tokens, temperature, timeout) -> str:
        from azure.ai.inference.models import SystemMessage, UserMessage

        client = self._inference_client()
        to = timeout if timeout and timeout > 0 else None
        resp = await asyncio.wait_for(client.complete(
            model=deployment,
            messages=[SystemMessage(content=system), UserMessage(content=user)],
            max_tokens=max_tokens,
            temperature=temperature,
        ), to)
        return resp.choices[0].message.content

    async def aclose(self) -> None:
        if self._inference is not None:
            await self._inference.close()
        try:
            self.cred.close()  # sync credential close is a no-op-safe best effort
        except Exception:  # noqa: BLE001
            pass


def model_label(settings: Settings, deployment: str) -> str:
    """Map a deployment to the short model badge the UI expects (panel.cast 'model')."""
    return {
        settings.gpt4o: "gpt-4o",
        settings.gpt4o_mini: "gpt-4o-mini",
        settings.oseries: "o-series",
        settings.phi4_deployment: "phi-4",
        settings.mistral_deployment: "mistral-large",
    }.get(deployment, deployment)
